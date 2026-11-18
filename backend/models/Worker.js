const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    /**
     * Array of sites this worker leader is assigned to.
     * Replaces the old single `site` field to allow multi-site assignment.
     */
    sites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Site', index: true }],
    /**
     * Legacy single-site field kept for backward compatibility with existing
     * attendance, payment, and audit-log records that reference `worker.site`.
     * Always points to the first entry in `sites`.
     */
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', index: true },
    /**
     * Human-readable site-prefixed Worker ID, e.g. "MCH-0001".
     * Auto-generated in workerService.createWorker using the primary (first) site's code.
     * Unique per site; sparse so existing records without it are unaffected.
     */
    workerId: { type: String, trim: true, index: true },
    photo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    profession: { type: mongoose.Schema.Types.ObjectId, ref: 'Profession', required: true },
    dailyWage: { type: Number, required: true, min: 0 },
    workerCount: { type: Number, default: 1, min: 0 },
    joiningDate: { type: Date, default: Date.now },
    address: { type: String, trim: true },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

workerSchema.index({ sites: 1, status: 1 });
workerSchema.index({ site: 1, status: 1 });
workerSchema.index({ name: 'text', phone: 'text' });
// Unique workerId per primary site; sparse so legacy records without workerId are not rejected
workerSchema.index({ site: 1, workerId: 1 }, { unique: true, sparse: true });

/**
 * Pre-save hook: keep `site` in sync as the first element of `sites`.
 * This ensures backward compat for queries and references using `site`.
 */
workerSchema.pre('save', function syncPrimarySite(next) {
  if (this.sites && this.sites.length > 0) {
    this.site = this.sites[0];
  }
  next();
});

module.exports = mongoose.model('Worker', workerSchema);
