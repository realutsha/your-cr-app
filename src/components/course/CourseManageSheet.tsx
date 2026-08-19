import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Course } from '../../types';
import { Field } from '../common/Field';

interface CourseManageSheetProps {
  courses: Course[];
  editingCourse?: Course | null;
  onClose: () => void;
  onCreateCourse: (name: string) => void;
  onUpdateCourse: (courseId: string, name: string) => void;
  onDeleteCourse: (courseId: string) => void;
}

export function CourseManageSheet({
  courses,
  editingCourse,
  onClose,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
}: CourseManageSheetProps) {
  const [courseName, setCourseName] = useState(editingCourse?.name || '');
  const isEditing = Boolean(editingCourse);

  return (
    <div style={{ padding: '0 20px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          {isEditing ? 'Edit course' : 'Manage courses'}
        </span>
        <button onClick={onClose} style={{ color: 'var(--c-text-faint)', padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!courseName.trim()) return;
          if (isEditing && editingCourse) {
            onUpdateCourse(editingCourse.id, courseName.trim());
          } else {
            onCreateCourse(courseName.trim());
            setCourseName('');
          }
        }}
        style={{ marginBottom: 24 }}
      >
        <Field
          label={isEditing ? 'Course Name' : 'Add New Course'}
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="e.g. Object Oriented Programming"
          autoFocus
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="submit"
            disabled={!courseName.trim()}
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'var(--c-accent)',
              padding: '10px 0',
              borderRadius: 10,
              cursor: courseName.trim() ? 'pointer' : 'default',
            }}
          >
            {isEditing ? 'Update course name' : 'Add course'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => editingCourse && onDeleteCourse(editingCourse.id)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--c-danger)',
                background: 'var(--c-danger-bg)',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </form>

      {!isEditing && (
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-text-faint)',
              marginBottom: 10,
            }}
          >
            Current Courses ({courses.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--c-card-bg)',
                  border: '1px solid var(--c-hairline)',
                  borderRadius: 10,
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--c-text)' }}>
                  {c.name}
                </span>
                <button
                  onClick={() => onDeleteCourse(c.id)}
                  style={{ color: 'var(--c-danger)', padding: 4 }}
                  title="Delete course"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
