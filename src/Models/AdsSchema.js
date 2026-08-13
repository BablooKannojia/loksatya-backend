import mongoose from "mongoose";

const AdsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    imgLink: {
      type: String,
      required: true,
    },

    noAds: {
      type: Number,
      default: 0,
    },

    noOfImpression: {
      type: Number,
      default: 0,
    },

    link: {
      type: String,
      default: "",
    },

    slugName: {
      type: String,
      required: true,
      index: true,
    },

    // IMPORTANT: String ki jagah Date
    StartAt: {
      type: Date,
      required: true,
      index: true,
    },

    EndAt: {
      type: Date,
      required: true,
      index: true,
    },

    Price: {
      type: Number,
      default: 0,
    },

    side: {
      type: String,
      enum: ["top", "mid", "bottom", "popup"],
      index: true,
    },

    device: {
      type: String,
      enum: ["mobile", "laptop", "both"],
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Dashboard/listing ke liye useful indexes
AdsSchema.index({ createdAt: -1 });
AdsSchema.index({ active: 1, StartAt: 1, EndAt: 1 });
AdsSchema.index({ side: 1, active: 1 });
AdsSchema.index({ device: 1, active: 1 });

const AdsS = mongoose.model("Ad", AdsSchema);

export { AdsS };