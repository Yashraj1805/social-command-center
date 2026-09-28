export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string;
  createdAt: Date;
}

export interface Permission {
  id: string;
  key: string;
  description: string;
}
