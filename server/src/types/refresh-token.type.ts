// Main refresh token interface
export interface IRefreshToken {
  id: string;
  user_id: string; // Foreign key to users table
  token: string; // The actual refresh token (hashed)
  expires_at: Date; // Expiration timestamp
  is_revoked: boolean; // Whether the token has been revoked
  createdAt: Date;
  updatedAt: Date;
}

// Interface for creating a new refresh token
export interface CreateRefreshTokenInput {
  user_id: string;
  token: string;
  expires_at: Date;
  is_revoked?: boolean; // Default is false
}

// Interface for refresh token response (without sensitive data)
export interface RefreshTokenResponse {
  id: string;
  user_id: string;
  expires_at: Date;
  is_revoked: boolean;
  createdAt: Date;
}

// Interface for token verification
export interface TokenVerification {
  isValid: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  token?: IRefreshToken;
}
