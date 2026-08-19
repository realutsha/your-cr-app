export type Role = 'student' | 'cr';

export interface User {
  id: string;
  email: string;
  username: string; // Extracted prefix before @diu.edu.bd (e.g. "251-35-118")
  role: Role;
  current_group_id?: string | null;
  created_at: string;
  last_active_at?: string;
}

export type ApprovalMode = 'auto' | 'manual';
export type GroupStatus = 'active' | 'expired' | 'archived';

export interface Group {
  id: string;
  name: string; // e.g. "Software Engineering — Section I"
  code: string; // 6-character code e.g. "K7X4P9"
  host_id: string;
  approval_mode: ApprovalMode;
  created_at: string;
  expires_at: string; // Exactly 4 months from creation
  status: GroupStatus;
  member_count?: number;
  host_username?: string;
}

export type MemberStatus = 'approved' | 'pending' | 'rejected' | 'removed';

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  status: MemberStatus;
  username?: string;
  email?: string;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  username?: string;
  email?: string;
  group_name?: string;
}

export interface Course {
  id: string;
  group_id: string;
  name: string; // e.g. "Object Oriented Programming", "Software Engineering"
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export type AcademicCategory = 'lab' | 'presentation' | 'assignment' | 'quiz';
export type AcademicSection = AcademicCategory;

export const CATEGORIES: { key: AcademicCategory; label: string; topicLabel: string; emptyLabel: string }[] = [
  { key: 'lab', label: 'Lab', topicLabel: 'Topics', emptyLabel: 'No updates in Lab' },
  { key: 'presentation', label: 'Presentation', topicLabel: 'Topic', emptyLabel: 'No updates in Presentation' },
  { key: 'assignment', label: 'Assignment', topicLabel: 'Requirements', emptyLabel: 'No updates in Assignment' },
  { key: 'quiz', label: 'Quiz', topicLabel: 'Syllabus / Topics', emptyLabel: 'No updates in Quiz' },
];

export type UpdateStatus = 'pending' | 'completed' | 'cancelled' | 'passed_deadline';

export interface AcademicUpdate {
  id: string;
  group_id: string;
  course_id: string;
  host_id: string;
  category: AcademicCategory; // 'lab' | 'presentation' | 'assignment' | 'quiz'
  section: AcademicCategory; // Backward compatibility alias
  course_name: string; // e.g. "Object Oriented Programming"
  title: string; // e.g. "Quiz 1", "Lab Test 1", "Assignment 2"
  date: string; // e.g. "15 Aug 2026" or "15 Aug"
  time: string; // e.g. "7:00 AM", "11:59 PM"
  topic?: string; // Syllabus / Topic / Requirements (e.g. "Array", "Dynamic Programming", "ERD + SQL DDL")
  description?: string; // Additional instructions/details
  resource_url?: string; // Optional external resource link (PDF, Drive, GitHub, Docs, etc.)
  status: UpdateStatus; // 'pending' | 'completed' | 'cancelled' | 'passed_deadline'
  created_at: string;
  updated_at: string;
  group_name?: string;
  host_username?: string;
  view_count?: number;
  total_members?: number;
  unread?: boolean;
  viewed_user_ids?: string[];
}

export interface UpdateView {
  id: string;
  update_id: string;
  announcement_id?: string;
  user_id: string;
  viewed_at: string;
  username?: string;
  email?: string;
}

export type NotificationType =
  | 'new_update'
  | 'update_modified'
  | 'join_request'
  | 'join_approved'
  | 'join_rejected';

export interface AppNotification {
  id: string;
  user_id: string;
  group_id?: string;
  update_id?: string;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}
