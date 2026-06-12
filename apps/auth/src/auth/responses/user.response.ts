import { User } from '@/generated/prisma';

export class UserResponse {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  createdAt!: Date;

  static from(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };
  }
}
