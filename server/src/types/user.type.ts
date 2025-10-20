export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string; // hashed password
  username?: string | null; // Unique username (optional)
  bio?: string | null; // Short bio (max 200 chars)
  avatar_url?: string | null; // Cloudinary avatar URL
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Registration (Input)
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

// Interface for Login
export interface LoginInput {
  email: string;
  password: string;
}

// Interface for Response (without password)
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Authentication Response
export interface AuthResponse {
  user: UserResponse;
  token: string; // JWT token
}

// Interface for Update Profile
export interface UpdateUserInput {
  name?: string;
  email?: string;
}

// Interface for Update Profile (New fields)
export interface UpdateProfileInput {
  username?: string | null;
  bio?: string | null;
}

// Interface for Avatar Upload Response
export interface AvatarUploadResponse {
  avatar_url: string;
}

// Interface for Changing Password
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
}
