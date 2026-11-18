import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Drawer from '../../components/drawers/Drawer';
import Button from '../../components/common/Button';
import FormField from '../../components/forms/FormField';
import DatePickerInput from '../../components/ui/DatePickerInput';
import FileUpload from '../../components/forms/FileUpload';
import PhoneField, { validatePhone } from '../../components/forms/PhoneInput';
import { Controller } from 'react-hook-form';
import CreatableSelect from '../../components/forms/CreatableSelect';
import { useCreateWorker, useUpdateWorker } from '../../hooks/useWorkers';
import { useLookups } from '../../hooks/useLookups';
import { useCreateProfession } from '../../hooks/useLookupsMutations';
import { useSiteScope } from '../../hooks/useSiteScope';
import { useToast } from '../../contexts/ToastContext';
import { toInputDate } from '../../utils/format';

const DEFAULTS = {
  sites: [], name: '', phone: '', profession: '', dailyWage: '', workerCount: 1, joiningDate: toInputDate(new Date()),
  address: '', emergencyContactName: '', emergencyContactPhone: '', status: 'active',
};

export default function WorkerFormModal({ isOpen, onClose, worker, defaultSiteId, onCreated }) {
  const isEdit = !!worker;
  const [photoFile, setPhotoFile] = useState(null);
  const { isSuperAdmin } = useSiteScope();
  const { professions, activeSites } = useLookups(defaultSiteId);
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const createProfession = useCreateProfession();
  const toast = useToast();
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: DEFAULTS });

  useEffect(() => {
    if (isOpen) {
      setPhotoFile(null);
      if (worker) {
        // Normalize existing worker sites for editing
        const workerSites = worker.sites?.length
          ? worker.sites.map((s) => s?._id ?? s)
          : [worker.site?._id ?? worker.site].filter(Boolean);
        reset({
          sites: workerSites,
          name: worker.name, phone: worker.phone ?? '',
          profession: worker.profession?._id ?? worker.profession,
          dailyWage: worker.dailyWage,
          workerCount: worker.workerCount ?? 1,
          joiningDate: toInputDate(worker.joiningDate),
          address: worker.address ?? '',
          emergencyContactName: worker.emergencyContact?.name ?? '',
          emergencyContactPhone: worker.emergencyContact?.phone ?? '',
          status: worker.status ?? 'active',
        });
      } else {
        reset({ ...DEFAULTS, sites: defaultSiteId ? [defaultSiteId] : [] });
      }
    }
  }, [isOpen, worker, defaultSiteId, reset]);

  const selectedSites = watch('sites') || [];

  const toggleSite = (siteId) => {
    const current = selectedSites;
    if (current.includes(siteId)) {
      setValue('sites', current.filter((id) => id !== siteId), { shouldValidate: true });
    } else {
      setValue('sites', [...current, siteId], { shouldValidate: true });
    }
  };

  const onSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        dailyWage: Number(values.dailyWage),
        workerCount: Number(values.workerCount) >= 0 ? Number(values.workerCount) : 1,
      };
      if (isEdit) {
        await updateWorker.mutateAsync({ id: worker._id, payload, photoFile });
        toast.success('Worker Leader updated.');
        onClose();
      } else {
        const result = await createWorker.mutateAsync({ payload, photoFile });
        toast.success('Worker Leader added.');
        if (onCreated && result?.data) {
          onCreated(result.data);
        } else {
          onClose();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Worker Leader' : 'Add Worker Leader'} size="md"
      footer={<><Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button><Button onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>{isEdit ? 'Save Changes' : 'Add Worker Leader'}</Button></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {isEdit && worker?.workerId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leader ID</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-700)' }}>{worker.workerId}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>Auto-generated · Read only</span>
            </div>
          )}
          {isSuperAdmin ? (
            <FormField
              label="Sites"
              required
              error={errors.sites?.message}
              className="form-field--full"
            >
              <Controller
                control={control}
                name="sites"
                rules={{ validate: (v) => (v && v.length > 0) || 'At least one site is required' }}
                render={() => {
                  const allSiteIds = activeSites.data?.map((s) => s._id) || [];
                  const allSelected = allSiteIds.length > 0 && allSiteIds.every((id) => selectedSites.includes(id));
                  const someSelected = allSiteIds.some((id) => selectedSites.includes(id));
                  return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    maxHeight: 210, overflowY: 'auto',
                    background: 'var(--color-bg-primary)',
                  }}>
                    {allSiteIds.length === 0 && (
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', padding: '8px 10px' }}>No sites available</span>
                    )}
                    {allSiteIds.length > 1 && (
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', cursor: 'pointer',
                          borderBottom: '1px solid var(--color-border)',
                          background: allSelected ? 'var(--color-primary-50)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={() => {
                            setValue('sites', allSelected ? [] : [...allSiteIds], { shouldValidate: true });
                          }}
                          style={{ accentColor: 'var(--color-primary-600)', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <span style={{
                          fontSize: 'var(--font-size-sm)', fontWeight: 600,
                          color: 'var(--color-text-primary)',
                        }}>
                          Select All
                        </span>
                        <span style={{
                          fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
                          marginLeft: 'auto',
                        }}>
                          {selectedSites.length}/{allSiteIds.length}
                        </span>
                      </label>
                    )}
                    {activeSites.data?.map((s) => {
                      const checked = selectedSites.includes(s._id);
                      return (
                        <label
                          key={s._id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', transition: 'background 0.15s',
                            background: checked ? 'var(--color-primary-50)' : 'transparent',
                            border: checked ? '1px solid var(--color-primary-200)' : '1px solid transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSite(s._id)}
                            style={{ accentColor: 'var(--color-primary-600)', width: 16, height: 16, flexShrink: 0 }}
                          />
                          <span style={{
                            fontSize: 'var(--font-size-sm)', fontWeight: checked ? 600 : 400,
                            color: checked ? 'var(--color-primary-700)' : 'var(--color-text-primary)',
                          }}>
                            {s.name}
                          </span>
                          <span style={{
                            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
                            marginLeft: 'auto', fontFamily: 'monospace',
                          }}>
                            {s.code}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  );
                }}
              />
              {selectedSites.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {selectedSites.map((siteId) => {
                    const site = activeSites.data?.find((s) => s._id === siteId);
                    return site ? (
                      <span
                        key={siteId}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 'var(--font-size-xs)', fontWeight: 600,
                          background: 'var(--color-primary-100)', color: 'var(--color-primary-700)',
                          borderRadius: 'var(--radius-full, 999px)', padding: '2px 10px',
                        }}
                      >
                        {site.name}
                        <button
                          type="button"
                          onClick={() => toggleSite(siteId)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 0, lineHeight: 1, fontSize: 14,
                            color: 'var(--color-primary-500)',
                          }}
                          aria-label={`Remove ${site.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </FormField>
          ) : (
            /* Site admins: auto-assign their own site */
            <input type="hidden" value={defaultSiteId ?? ''} {...register('sites')} />
          )}
          <FormField label="Worker Leader Name" required error={errors.name?.message}>
            <input className="form-input" placeholder="e.g. Mark" {...register('name', { required: 'Name is required', setValueAs: v => (typeof v === 'string' ? v.trim() : v) })} />
          </FormField>
          <FormField label="Profession" required error={errors.profession?.message}>
            <Controller
              control={control}
              name="profession"
              rules={{ required: 'Profession is required' }}
              render={({ field }) => (
                <CreatableSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={professions.data || []}
                  onCreate={(name) => createProfession.mutateAsync(name)}
                  placeholder="Select or create profession..."
                  isLoading={professions.isLoading}
                />
              )}
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <FormField label="Daily Wage (₹)" required error={errors.dailyWage?.message}>
              <input type="number" min="0" className="form-input" placeholder="800" {...register('dailyWage', { required: 'Daily wage is required' })} />
            </FormField>
            <FormField label="Status">
              <select className="form-select" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormField label="Emergency Phone (Optional)">
            <Controller control={control} name="emergencyContactPhone" rules={{ validate: (v) => !v || validatePhone(v) || 'Invalid phone number' }} render={({ field }) => <PhoneField value={field.value} onChange={field.onChange} />} />
          </FormField>
          <div className="form-field--full">
            <FileUpload label="Photo (Optional)" accept="image/*" value={photoFile} onChange={setPhotoFile} />
            {worker?.photo?.url && !photoFile && <img src={worker.photo.url} alt="" style={{ width: 64, height: 64, borderRadius: 8, marginTop: 8, objectFit: 'cover' }} />}
          </div>
        </div>
      </form>
    </Drawer>
  );
}
