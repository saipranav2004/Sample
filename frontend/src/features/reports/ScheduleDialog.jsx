import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check } from 'lucide-react';
import { CADENCES, REPORT_FORMATS, REPORT_TEMPLATES, templateById } from '../../lib/demo/reports';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/Field';
import { Modal } from '../../ui/Overlay';

/**
 * Create or edit a schedule.
 *
 * Validated rather than merely collected: a schedule with no recipients is a
 * report nobody reads, and an hour outside 0-23 is not a time. Errors appear
 * per field on submit and clear as the field is corrected, so the dialog never
 * blocks with a single opaque message.
 */
const EMPTY = { templateId: '', cadence: 'weekly', hour: 7, format: '', recipients: '' };

export function ScheduleDialog({ open, onClose, onSave, initial, presetTemplateId }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  /* Reset whenever the dialog opens, so a cancelled edit never leaks into the
     next one. */
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setValues({
        templateId: initial.templateId,
        cadence: initial.cadence,
        hour: initial.hour ?? 7,
        format: initial.format,
        recipients: (initial.recipients ?? []).join(', '),
      });
    } else {
      const templateId = presetTemplateId || '';
      const template = templateById(templateId);
      setValues({
        ...EMPTY,
        templateId,
        cadence: template?.cadenceHint ?? 'weekly',
        format: template?.formats[0] ?? '',
      });
    }
    setErrors({});
  }, [open, initial, presetTemplateId]);

  const template = templateById(values.templateId);

  const formatOptions = useMemo(
    () =>
      (template?.formats ?? Object.keys(REPORT_FORMATS)).map((key) => ({
        value: key,
        label: `${REPORT_FORMATS[key].label} - ${REPORT_FORMATS[key].hint}`,
      })),
    [template],
  );

  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const found = {};
    if (!values.templateId) found.templateId = 'Choose which report to schedule.';
    if (!values.format) found.format = 'Choose an output format.';

    const hour = Number(values.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      found.hour = 'Enter an hour between 0 and 23.';
    }

    const recipients = values.recipients
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      found.recipients = 'Add at least one recipient, or nobody receives it.';
    } else {
      const invalid = recipients.filter((entry) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry));
      if (invalid.length > 0) found.recipients = `Not an address: ${invalid.join(', ')}`;
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      templateId: values.templateId,
      cadence: values.cadence,
      hour,
      format: values.format,
      recipients,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit schedule' : 'Schedule a report'}
      description="Scheduled reports are produced without anyone asking, so who receives them matters as much as what they contain."
      icon={CalendarClock}
      tone="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Check} onClick={submit}>
            {initial ? 'Save schedule' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Report" htmlFor="schedule-template" error={errors.templateId}>
          <Select
            id="schedule-template"
            value={values.templateId}
            invalid={Boolean(errors.templateId)}
            onChange={(event) => {
              const next = templateById(event.target.value);
              setValues((current) => ({
                ...current,
                templateId: event.target.value,
                cadence: next?.cadenceHint ?? current.cadence,
                format: next?.formats[0] ?? '',
              }));
              setErrors({});
            }}
            placeholder="Choose a report"
            options={REPORT_TEMPLATES.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        </Field>

        {template && (
          <p className="-mt-1 text-[11.5px] leading-relaxed text-ink-3">
            {template.purpose} Written for {template.audience.toLowerCase()}.
          </p>
        )}

        <div className="grid gap-4 @min-[24rem]:grid-cols-2">
          <Field label="Cadence" htmlFor="schedule-cadence">
            <Select
              id="schedule-cadence"
              value={values.cadence}
              onChange={(event) => set('cadence', event.target.value)}
              options={Object.entries(CADENCES).map(([key, meta]) => ({
                value: key,
                label: `${meta.label} - ${meta.hint}`,
              }))}
            />
          </Field>

          <Field label="Hour (UTC)" htmlFor="schedule-hour" error={errors.hour} hint="0 to 23">
            <Input
              id="schedule-hour"
              type="number"
              min="0"
              max="23"
              value={values.hour}
              invalid={Boolean(errors.hour)}
              onChange={(event) => set('hour', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Format" htmlFor="schedule-format" error={errors.format}>
          <Select
            id="schedule-format"
            value={values.format}
            invalid={Boolean(errors.format)}
            onChange={(event) => set('format', event.target.value)}
            placeholder="Choose a format"
            options={formatOptions}
          />
        </Field>

        <Field
          label="Recipients"
          htmlFor="schedule-recipients"
          error={errors.recipients}
          hint="Comma separated"
        >
          <Input
            id="schedule-recipients"
            type="text"
            autoComplete="off"
            placeholder="secops@example.com, ciso@example.com"
            value={values.recipients}
            invalid={Boolean(errors.recipients)}
            onChange={(event) => set('recipients', event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
