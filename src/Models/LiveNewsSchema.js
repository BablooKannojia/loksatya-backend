import mongoose from "mongoose";

const LiveNewsSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
        },
        description: String,      // Intro
        category: String,
        subCategory: String,
        image: String,            // Main image
        reportedBy: String,
        publishBy: String,
        tags: [String],
        status: {
            type: String,
            enum: ["online", "offline"],
            default: "online",
        },
        live: {
            type: Boolean,
            default: true,
        },
        // Article ki tarah — homepage slider me dikhane ke liye position 1-4
        sliderOrder: {
            type: Number,
            min: 1,
            max: 4,
        },
    },
    {
        timestamps: true,
    }
);

const LiveNewsUpdateSchema = new mongoose.Schema(
    {
        liveNewsId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LiveNews",
            required: true,
        },
        title: String,
        description: String,
        image: String,
        images: [String],
        postedBy: String,
    },
    {
        timestamps: true,
    }
);

// Index for fast "get updates by live news id, sorted" queries
LiveNewsUpdateSchema.index({ liveNewsId: 1, createdAt: -1 });

export const LiveNews = mongoose.model("LiveNews", LiveNewsSchema);
export const LiveNewsUpdate = mongoose.model("LiveNewsUpdate", LiveNewsUpdateSchema);