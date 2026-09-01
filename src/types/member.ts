export interface Member {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  image_path?: string | null;
  status: string;
  notes?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMemberInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}
