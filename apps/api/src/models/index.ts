import mongoose, { Schema, type Model } from "mongoose";
import type { Kit } from "@prepkit/shared";

export interface UserDoc {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
export const User: Model<UserDoc> = mongoose.models.User ?? mongoose.model<UserDoc>("User", UserSchema);

export interface KitDoc {
  userId: mongoose.Types.ObjectId;
  status: "generating" | "ready" | "failed";
  jd: string;
  jdHash: string;
  companyUrl: string;
  days: number;
  steps: { key: string; label: string; status: string; detail?: string }[];
  error: { code: string; message: string } | null;
  kit: Kit | null;
  practice: Record<string, { confidence: number; lastSeen: string; timesSeen: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<KitDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["generating", "ready", "failed"], default: "generating", index: true },
  jd: { type: String, required: true },
  jdHash: { type: String, index: true },
  companyUrl: { type: String, required: true },
  days: { type: Number, required: true, min: 1, max: 60 },
  steps: { type: [{ key: String, label: String, status: String, detail: String }], default: [] },
  error: {
    code: String,
    message: String,
  },
  kit: { type: Schema.Types.Mixed, default: null },
  practice: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
export const KitModel: Model<KitDoc> = (mongoose.models.Kit as any) ??
  mongoose.model<KitDoc>("Kit", KitSchema);
