export type Course    = { course_id: number; name: string; description?: string; level_id?: number; robot_type_id?: number; level_name?: string; robot_type_name?: string };
export type RobotType = { robot_type_id: number; name: string };
export type Level     = { level_id: number; name: string };
export type Student   = { student_id: number; name: string; nickname?: string; classes_remaining: number; approval_status: string };
export type CusPkg    = { customer_package_id: number; package_id: number; package_name: string; class_count: number; classes_remaining: number; course_name: string; course_id: number };
export type Schedule  = { schedule_id: number; starts_at: string; ends_at: string; course_name?: string; enrolled_count: number; max_capacity: number };
export type Announcement = { announcement_id: number; title: string; body?: string; image_url?: string; send_to: string; created_at: string; created_by_name?: string };
export type StaffUser = { user_id: number; name: string; email: string; phone?: string; role: string; monthly_salary?: number; active_from?: string; active_until?: string; created_at: string };
