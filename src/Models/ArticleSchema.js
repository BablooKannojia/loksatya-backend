import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const ArticleSchema = mongoose.Schema(
  {
    topic: { 
      type: String, 
      index: true,
      trim: true
    },
    UserID: {
      type: String,
      required: true,
      index: true
    },
    _id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    discription: {
      type: String,
      required: true,
    },
    approved: {
      type: Boolean,
      default: false,
      index: true
    },
    keyWord: [{
      type: String,
      trim: true
    }],
    image: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    language: {
      type: String,
      enum: ["English", "Hindi", "Urdu"],
      required: true,
      index: true
    },
    reportedBy: {
      type: String,
      required: true,
      index: true
    },
    publishBy: {
      type: String,
      required: true,
      index: true
    },
    newsType: {
      type: String,
      required: true,
      enum: ["breakingNews", "topStories", "all", "upload"],
      index: true
    },
    type: {
      type: String,
      enum: ["img", "vid"],
      default: "img",
      index: true
    },
    subCategory: {
      type: String,
      index: true,
      trim: true
    },
    comment: {
      type: Boolean,
      default: false,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true
    },
    priority: {
      type: Boolean,
      default: false,
      index: true
    },
    slider: {
      type: Boolean,
      default: false,
      index: true
    },
    sliderOrder: {
      type: Number,
      default: null,
      index: true
    },
    publishAt: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'online', 'offline', 'published'],
      default: 'draft',
      index: true
    },
    lastPublishedAt: {
      type: Date,
      default: Date.now
    },
    fixedPosition: {
      type: Number,
      enum: [1, 2],
      sparse: true
    },
  },
  {
    timestamps: true,
  }
);


// Add these compound indexes to your schema
ArticleSchema.index({ createdAt: -1, approved: 1 });
ArticleSchema.index({ newsType: 1, status: 1, createdAt: -1 });
ArticleSchema.index({ topic: 1, createdAt: -1 });
ArticleSchema.index({ priority: 1, createdAt: -1 });
ArticleSchema.index({ slider: 1, createdAt: -1 });

ArticleSchema.index({ sliderOrder: 1 });
ArticleSchema.index({ slider: 1, sliderOrder: 1 });

// Create compound indexes for better query performance
ArticleSchema.index({ approved: 1, status: 1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ topic: 1, status: 1 });
ArticleSchema.index({ newsType: 1, status: 1 });
ArticleSchema.index({ priority: 1, createdAt: -1 });
ArticleSchema.index({ slider: 1, createdAt: -1 });

// Text index for search functionality
ArticleSchema.index({
  title: 'text',
  discription: 'text',
  topic: 'text',
  keyWord: 'text'
});

const ReportSchema = mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  articleId: {
    type: String,
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
  },
}, { timestamps: true });

const ContentSchema = mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ["tag", "category"],
    index: true
  },
  text: {
    type: String,
    required: true,
  },
  sequence: {
    type: Number,
    required: function () {
      return this.type === "category";
    },
  },
}, { timestamps: true });

// Create unique indexes for Content schema
ContentSchema.index({ adminId: 1, type: 1 });
ContentSchema.index({ type: 1, createdAt: -1 });
ContentSchema.index({ adminId: 1, type: 1, createdAt: -1 });
ContentSchema.index({ text: 1, type: 1 }, { unique: true });
ContentSchema.index({ sequence: 1, type: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { type: "category" } 
});

const subCategorySchema = mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true,
  },
}, { timestamps: true });

subCategorySchema.index({ category: 1, text: 1 }, { unique: true });

const Article = mongoose.model("Article", ArticleSchema);
const Report = mongoose.model("Report", ReportSchema);
const Content = mongoose.model("Content", ContentSchema);
const SubCategory = mongoose.model("SubCategory", subCategorySchema);

export { Article, Report, Content, SubCategory };