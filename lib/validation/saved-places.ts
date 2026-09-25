import { z } from "zod";

export const savedPlaceStatusSchema = z.enum(["WISHLIST", "PLANNED", "VISITED"]);

export const createSavedPlaceSchema = z.object({
  destination: z.string().trim().min(1, "Destination is required"),
  note: z.string().trim().optional(),
  status: savedPlaceStatusSchema,
});

export type CreateSavedPlaceInput = z.infer<typeof createSavedPlaceSchema>;
