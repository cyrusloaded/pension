import { prisma } from "@/lib/database/prisma";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "ASSIGNMENT";
  link?: string;
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type ?? "INFO",
        link: params.link,
      },
    });
  } catch (e) {
    console.error("Failed to create notification:", e);
  }
}

export async function notifyUserByEmail(
  email: string,
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await createNotification({ ...params, userId: user.id });
  }
}
