const workerRepository = require('../repositories/worker.repository');
const WorkerPayment = require('../models/WorkerPayment');
const Worker = require('../models/Worker');
const Site = require('../models/Site');
const { resolveSiteScope, assertSiteAccess } = require('../utils/siteScope');
const { buildPaginatedResult, buildSort, buildTextSearchFilter } = require('../utils/pagination');
const { uploadBuffer, deleteAsset } = require('./uploadService');
const { recordActivity } = require('./auditLogService');
const ApiError = require('../utils/ApiError');

/**
 * Generates a site-prefixed human-readable Worker ID, e.g. "MCH-0001".
 * Finds the current highest numeric suffix for this site and increments.
 */
async function generateWorkerId(siteId) {
  const site = await Site.findById(siteId).select('code');
  const prefix = site?.code ? `${site.code}-` : 'W-';

  // Find all workerIds for this site that start with the prefix (non-deleted + deleted)
  const latest = await Worker.findOne(
    { site: siteId, workerId: { $regex: `^${prefix}` } },
    { workerId: 1 }
  ).sort({ workerId: -1 });

  let nextNum = 1;
  if (latest?.workerId) {
    const parts = latest.workerId.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

async function createWorker(data, actor, file, req) {
  // Normalize: accept `sites` array or legacy `site` field
  let targetSites = data.sites || (data.site ? [data.site] : []);
  if (!Array.isArray(targetSites)) targetSites = [targetSites];
  if (targetSites.length === 0 && actor.role === 'site_admin') {
    targetSites = [actor.assignedSite?.toString()];
  }
  if (targetSites.length === 0) throw ApiError.badRequest('At least one project site is required');

  // Verify access to every selected site
  targetSites.forEach((siteId) => assertSiteAccess(actor, siteId));

  let photo = null;
  if (file) {
    photo = await uploadBuffer(file.buffer, 'mala-erp/workers/photos');
  }

  // Use the primary (first) site for the Worker ID prefix
  const primarySite = targetSites[0];
  const workerId = await generateWorkerId(primarySite);

  const worker = await workerRepository.create({
    sites: targetSites,
    site: primarySite,
    workerId,
    name: data.name,
    phone: data.phone || '',
    profession: data.profession,
    dailyWage: Number(data.dailyWage) || 0,
    workerCount: Number(data.workerCount) >= 0 ? Number(data.workerCount) : 1,
    joiningDate: data.joiningDate || new Date(),
    address: data.address || '',
    emergencyContact: {
      name: data.emergencyContactName || '',
      phone: data.emergencyContactPhone || '',
    },
    status: data.status ?? 'active',
    photo,
    createdBy: actor._id,
  });

  await recordActivity({
    actor, action: 'create', entityType: 'Worker', entityId: worker._id, site: primarySite, after: worker.toObject(), req,
  });

  return workerRepository.findById(worker._id);
}

async function listWorkers(queryParams, actor) {
  const { page, limit, search, profession, status, sortBy, sortOrder, siteId, showDeleted } = queryParams;
  const siteFilter = resolveSiteScope(actor, siteId);

  // Workers now have a `sites` array — translate { site: X } to match either field
  const sitesQuery = siteFilter.site ? { $or: [{ sites: siteFilter.site }, { site: siteFilter.site }] } : {};

  const query = {
    ...sitesQuery,
    ...(profession && { profession }),
    ...(status && { status }),
    ...buildTextSearchFilter(search, ['name', 'phone']),
  };

  const sort = buildSort(sortBy, sortOrder, ['name', 'dailyWage', 'joiningDate', 'createdAt'], 'name');
  const { items, total } = await workerRepository.findAll(query, { page, limit, sort }, showDeleted === 'true' || showDeleted === true);
  return buildPaginatedResult(items, total, page, limit);
}

/**
 * Lightweight worker search for the Attendance worker picker.
 * Searches by workerId, name, or phone for active workers at the actor's site.
 */
async function searchWorkers(queryParams, actor) {
  const { q = '', siteId, limit = 10 } = queryParams;
  const siteFilter = resolveSiteScope(actor, siteId);

  const trimmed = q.trim();
  const searchFilter = trimmed
    ? {
        $or: [
          { workerId: { $regex: trimmed, $options: 'i' } },
          { name: { $regex: trimmed, $options: 'i' } },
          { phone: { $regex: trimmed, $options: 'i' } },
        ],
      }
    : {};

  // Match workers assigned to the site in either `sites` array or legacy `site` field
  const sitesQuery = siteFilter.site ? { $or: [{ sites: siteFilter.site }, { site: siteFilter.site }] } : {};

  return Worker.find({
    ...sitesQuery,
    ...searchFilter,
    status: 'active',
    isDeleted: false,
  })
    .populate([
      { path: 'profession', select: 'name' },
      { path: 'sites', select: 'name code' },
      { path: 'site', select: 'name code' },
    ])
    .select('workerId name phone profession dailyWage sites site status')
    .limit(Number(limit))
    .sort({ name: 1 });
}

async function getWorkerById(id, actor) {
  const worker = await workerRepository.findById(id);
  if (!worker) throw ApiError.notFound('Worker not found');
  // Check access against any of the worker's assigned sites
  const workerSites = worker.sites?.length ? worker.sites : [worker.site];
  const siteToCheck = workerSites.find((s) => {
    const sid = s?._id ?? s;
    return sid?.toString() === actor.assignedSite?.toString();
  }) || workerSites[0];
  assertSiteAccess(actor, siteToCheck?._id ?? siteToCheck);
  return worker;
}

async function getWorkerProfile(id, actor) {
  const worker = await getWorkerById(id, actor);
  const payments = await WorkerPayment.find({ worker: id })
    .sort({ paidOn: -1 })
    .limit(20)
    .select('workingDays dailyWage bonus advance deduction netSalary paidOn status paymentMethod remarks');

  const totals = await WorkerPayment.aggregate([
    { $match: { worker: worker._id, status: 'paid' } },
    { $group: { _id: null, totalPaid: { $sum: '$netSalary' } } },
  ]);

  const totalPaid = totals[0]?.totalPaid ?? 0;

  return {
    worker,
    payments,
    totalPaid,
    recentPayments: payments.slice(0, 5),
  };
}

async function updateWorker(id, data, actor, file, req) {
  const before = await getWorkerById(id, actor);
  const update = { ...data };

  // Handle sites update: keep `site` in sync as primary
  if (update.sites && Array.isArray(update.sites) && update.sites.length > 0) {
    update.sites.forEach((siteId) => assertSiteAccess(actor, siteId));
    update.site = update.sites[0];
  }
  // Remove legacy single-site field from update payload
  delete update.site_legacy;

  if (data.emergencyContactName !== undefined || data.emergencyContactPhone !== undefined) {
    update.emergencyContact = {
      name: data.emergencyContactName ?? before.emergencyContact?.name,
      phone: data.emergencyContactPhone ?? before.emergencyContact?.phone,
    };
    delete update.emergencyContactName;
    delete update.emergencyContactPhone;
  }

  if (file) {
    if (before.photo?.publicId) await deleteAsset(before.photo.publicId);
    update.photo = await uploadBuffer(file.buffer, 'mala-erp/workers/photos');
  }

  const updated = await workerRepository.updateById(id, update);
  const primarySite = updated.sites?.[0]?._id ?? updated.site?._id ?? updated.site;
  await recordActivity({
    actor, action: 'update', entityType: 'Worker', entityId: id,
    site: primarySite, before: before.toObject(), after: updated.toObject(), req,
  });
  return updated;
}

async function deleteWorker(id, actor, req) {
  const worker = await getWorkerById(id, actor);
  // Soft delete the worker
  await workerRepository.softDelete(id, actor);
  await recordActivity({
    actor,
    action: 'delete',
    entityType: 'Worker',
    entityId: id,
    site: worker.sites?.[0]?._id ?? worker.site?._id ?? worker.site,
    before: worker.toObject(),
    req,
  });
}

async function restoreWorker(id, actor, req) {
  const worker = await workerRepository.findById(id, true); // Include deleted
  if (!worker) {
    throw ApiError.notFound('Worker not found');
  }
  if (!worker.isDeleted) {
    throw ApiError.badRequest('Worker is not deleted');
  }

  const restored = await workerRepository.restore(id);
  await recordActivity({
    actor,
    action: 'restore',
    entityType: 'Worker',
    entityId: id,
    site: worker.sites?.[0]?._id ?? worker.site?._id ?? worker.site,
    after: restored.toObject(),
    req,
  });
  return restored;
}

module.exports = {
  createWorker,
  listWorkers,
  searchWorkers,
  getWorkerById,
  getWorkerProfile,
  updateWorker,
  deleteWorker,
  restoreWorker,
};

