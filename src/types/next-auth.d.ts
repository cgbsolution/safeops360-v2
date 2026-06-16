import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      plantId: string | null;
      plantName: string | null;
      designation: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    plantId?: string | null;
    plantName?: string | null;
    designation?: string | null;
  }
}
