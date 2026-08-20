import { useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES, type AcademicCategory, type AcademicUpdate, type Course, type UpdateStatus } from '../../types';
import { Field } from '../common/Field';
import { LIMITS, validateText, validateUrl } from '../../lib/validation';

const STATUS_OPTIONS: { key: UpdateStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'passed_deadline', label: 'Passed deadline' },
];

interface ComposeSheetProps {
  courses: Course[];
  initialUpdate?: AcademicUpdate | null;
  defaultCourseId?: string;
  defaultCategory?: AcademicCategory;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic: string;
    description: string;
    resource_url?: string;
    status: UpdateStatus;
  }) => void;
}

export function ComposeSheet({
  courses,
  initialUpdate,
  defaultCourseId,
  defaultCategory = 'quiz',
  onClose,
  onSave,
}: ComposeSheetProps) {
  const isEditing = Boolean(initialUpdate);
  const [courseId, setCourseId] = useState<string>(
    initialUpdate?.course_id || defaultCourseId || (courses[0]?.id || '')
  );
  const [category, setCategory] = useState<AcademicCategory>(
    initialUpdate?.category || initialUpdate?.section || defaultCategory
  );
  const [title, setTitle] = useState(initialUpdate?.title || '');
  const [date, setDate] = useState(initialUpdate?.date || '');
  const [time, setTime] = useState(initialUpdate?.time || '');
  const [topic, setTopic] = useState(initialUpdate?.topic || '');
  const [description, setDescription] = useState(initialUpdate?.description || '');
  const [resourceUrl, setResourceUrl] = useState(initialUpdate?.resource_url || '');
  const [status, setStatus] = useState<UpdateStatus>(initialUpdate?.status || 'pending');

  const titleValidation = validateText(title, {
    fieldName: 'Title',
    maxLength: LIMITS.ANNOUNCEMENT_TITLE,
    required: true,
  });

  const topicValidation = validateText(topic, {
    fieldName: 'Topic / Syllabus',
    maxLength: LIMITS.ANNOUNCEMENT_TOPIC,
    required: false,
  });

  const descValidation = validateText(description, {
    fieldName: 'Description',
    maxLength: LIMITS.ANNOUNCEMENT_DESCRIPTION,
    required: false,
  });

  const dateValidation = validateText(date, {
    fieldName: 'Date',
    maxLength: LIMITS.DATE,
    required: true,
  });

  const timeValidation = validateText(time, {
    fieldName: 'Time',
    maxLength: LIMITS.TIME,
    required: false,
  });

  const urlValidation = validateUrl(resourceUrl, 'Resource Link');

  const canSave = Boolean(
    courseId &&
    titleValidation.isValid &&
    topicValidation.isValid &&
    descValidation.isValid &&
    dateValidation.isValid &&
    timeValidation.isValid &&
    urlValidation.isValid
  );

  const activeTopicLabel =
    CATEGORIES.find((s) => s.key === category)?.topicLabel || 'Topic / Syllabus';

  const handleFormSubmit = () => {
    if (!canSave) return;

    onSave({
      id: initialUpdate?.id,
      course_id: courseId,
      category,
      title: titleValidation.sanitized,
      date: dateValidation.sanitized,
      time: timeValidation.sanitized || 'TBA',
      topic: topicValidation.sanitized,
      description: descValidation.sanitized,
      resource_url: urlValidation.sanitized || undefined,
      status,
    });
  };

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          {isEditing ? 'Edit update' : 'New academic update'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled={!canSave}
            onClick={handleFormSubmit}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: canSave ? 'var(--c-accent)' : 'var(--c-text-faint)',
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {isEditing ? 'Save' : 'Post'}
          </button>
          <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Course Selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Course
        </label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--c-text)',
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-hairline-strong)',
            borderRadius: 10,
            padding: '10px 12px',
            outline: 'none',
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category Selector */}
      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Update Type / Category
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CATEGORIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setCategory(s.key)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: category === s.key ? 700 : 500,
                color: category === s.key ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '6px 12px',
                borderRadius: 8,
                background: category === s.key ? 'var(--c-card-bg-active)' : 'transparent',
                border: `1px solid ${category === s.key ? 'var(--c-hairline-strong)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Title"
        value={title}
        maxLength={LIMITS.ANNOUNCEMENT_TITLE}
        showCount
        error={title.length > LIMITS.ANNOUNCEMENT_TITLE ? titleValidation.error : undefined}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Quiz 1, Lab Test 1, Assignment 2"
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field
            label="Date"
            value={date}
            maxLength={LIMITS.DATE}
            showCount={date.length > LIMITS.DATE * 0.7}
            error={date.length > LIMITS.DATE ? dateValidation.error : undefined}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g. 15 Aug"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Field
            label="Time"
            value={time}
            maxLength={LIMITS.TIME}
            showCount={time.length > LIMITS.TIME * 0.7}
            error={time.length > LIMITS.TIME ? timeValidation.error : undefined}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 7:00 AM / 11:59 PM"
          />
        </div>
      </div>

      <Field
        label={activeTopicLabel}
        value={topic}
        maxLength={LIMITS.ANNOUNCEMENT_TOPIC}
        showCount
        error={topic.length > LIMITS.ANNOUNCEMENT_TOPIC ? topicValidation.error : undefined}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Array, Polymorphism, ERD + SQL"
      />

      <Field
        as="textarea"
        label="Additional Instructions / Description"
        rows={3}
        value={description}
        maxLength={LIMITS.ANNOUNCEMENT_DESCRIPTION}
        showCount
        error={description.length > LIMITS.ANNOUNCEMENT_DESCRIPTION ? descValidation.error : undefined}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Room number, materials to bring, or submission guidelines..."
      />

      {/* Optional Resource / Link Field */}
      <div>
        <Field
          label="Resource / Link (optional)"
          value={resourceUrl}
          maxLength={LIMITS.URL}
          showCount={resourceUrl.length > 50}
          error={!urlValidation.isValid ? urlValidation.error : undefined}
          onChange={(e) => setResourceUrl(e.target.value)}
          placeholder="e.g. https://drive.google.com/file/... or GitHub link"
        />
      </div>

      {/* Status Picker */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--c-text-faint)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Status
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st.key}
              onClick={() => setStatus(st.key)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: status === st.key ? 600 : 400,
                color: status === st.key ? 'var(--c-text)' : 'var(--c-text-faint)',
                padding: '4px 8px',
                borderRadius: 6,
                background: status === st.key ? 'var(--c-card-bg-active)' : 'transparent',
                border: `1px solid ${status === st.key ? 'var(--c-hairline-strong)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
