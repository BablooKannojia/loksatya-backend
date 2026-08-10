import { LiveNews, LiveNewsUpdate } from "../Models/LiveNewsSchema.js";
import { errHandler, responseHandler } from "../helper/response.js";
import { Storage } from "../Config/firebase.config.js";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";

const uploadToFirebase = async (file, folder = "live-news") => {
    if (!file) return "";
    const storageRef = ref(
        Storage,
        `${folder}/${Date.now()}_${file.originalname}`
    );
    await uploadBytesResumable(storageRef, file.buffer, {
        contentType: file.mimetype,
    });
    return await getDownloadURL(storageRef);
};

const uploadMultipleImages = async (files = [], folder = "live-news/gallery") => {
    if (!files.length) return [];
    const images = [];
    for (const file of files) {
        const url = await uploadToFirebase(file, folder);
        images.push(url);
    }
    return images;
};

const deleteFirebaseFile = async (url) => {
    if (!url) return;
    try {
        const fileRef = ref(Storage, url);
        await deleteObject(fileRef);
    } catch (err) {
        if (err.code !== "storage/object-not-found") {
            console.error(err);
        }
    }
};

// ==================== CREATE MAIN LIVE NEWS ====================
export const CreateLiveNews = async (req, res) => {
  try {
    const {
      title,
      slug,
      description,
      category,
      subCategory,
      reportedBy,
      publishBy,
      tags,
      status = "online",
      live = true,
    } = req.body;

    const finalSlug = slug?.trim().toLowerCase();

    // Slug duplicate check (sirf slug ho tabhi)
    if (finalSlug) {
      const checkSlug = await LiveNews.findOne({ slug: finalSlug });

      if (checkSlug) {
        return errHandler(res, "Slug already exists", 400);
      }
    }

    let image = "";
    let gallery = [];

    if (req.files?.image?.length > 0) {
      image = await uploadToFirebase(
        req.files.image[0],
        "live-news/main"
      );
    }

    if (req.files?.gallery?.length > 0) {
      gallery = await uploadMultipleImages(
        req.files.gallery,
        "live-news/gallery"
      );
    }

    let finalTags = [];

    if (tags) {
      if (Array.isArray(tags)) {
        finalTags = tags;
      } else {
        try {
          finalTags = JSON.parse(tags);
        } catch {
          finalTags = tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        }
      }
    }

    const news = await LiveNews.create({
      title,
      slug: finalSlug,
      description,
      category,
      subCategory,
      image,
      gallery,
      reportedBy,
      publishBy,
      tags: finalTags,
      status,
      live,
    });

    return responseHandler(res, news);
  } catch (err) {
    console.error(err);
    return errHandler(res, err.message, 500);
  }
};

// ==================== ADD A LIVE UPDATE (timeline entry) ====================
export const AddLiveNewsUpdate = async (req, res) => {
    try {
        const { title, description, postedBy } = req.body;

        if (!description) {
            return errHandler(res, "Update description is required", 400);
        }

        const liveNews = await LiveNews.findById(req.params.id);
        if (!liveNews) {
            return errHandler(res, "Live News not found", 404);
        }

        let image = "";
        let images = [];
        if (req.files?.image?.length) {
            image = await uploadToFirebase(req.files.image[0], "live-news/updates");
        }
        if (req.files?.images?.length) {
            images = await uploadMultipleImages(req.files.images, "live-news/updates");
        }

        const update = await LiveNewsUpdate.create({
            liveNewsId: liveNews._id,
            title,
            description,
            image,
            images,
            postedBy,
        });

        return responseHandler(res, update);
    } catch (err) {
        console.error(err);
        return errHandler(res, err.message, 500);
    }
};

// ==================== GET ALL (public - homepage list) ====================
export const GetAllLiveNews = async (req, res) => {
    try {
        const data = await LiveNews.find({
            status: "online",
            live: true,
        }).sort({ createdAt: -1 });
        return responseHandler(res, data);
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== GET SINGLE (public - live blog page) ====================
export const GetSingleLiveNews = async (req, res) => {
    try {
        const news = await LiveNews.findOne({
            slug: req.params.slug.trim().toLowerCase(),
        });
        if (!news) {
            return errHandler(res, "News not found", 404);
        }

        // Latest update sabse upar (jaise Aaj Tak me dikhta hai)
        const updates = await LiveNewsUpdate.find({
            liveNewsId: news._id,
        }).sort({ createdAt: -1 });

        return responseHandler(res, { news, updates });
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== GET ALL (admin list with pagination) ====================
export const GetAllLiveNewsAdmin = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = "", status } = req.query;

        page = Number(page);
        limit = Number(limit);
        const filter = {};

        if (status) {
            filter.status = status;
        }
        if (search) {
            search = search.trim().toLowerCase();
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const total = await LiveNews.countDocuments(filter);
        const news = await LiveNews.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const data = await Promise.all(
            news.map(async (item) => {
                const totalUpdates = await LiveNewsUpdate.countDocuments({
                    liveNewsId: item._id,
                });
                const latestUpdate = await LiveNewsUpdate.findOne({
                    liveNewsId: item._id,
                })
                    .sort({ createdAt: -1 })
                    .select("createdAt");
                return {
                    ...item,
                    totalUpdates,
                    latestUpdateAt: latestUpdate ? latestUpdate.createdAt : null,
                };
            })
        );

        return responseHandler(res, {
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            data,
        });
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== UPDATE MAIN LIVE NEWS ====================
export const UpdateLiveNews = async (req, res) => {
    try {
        const {
            title,
            slug,
            description,
            category,
            subCategory,
            reportedBy,
            publishBy,
            tags,
            status,
            live,
        } = req.body;

        const finalSlug = slug?.trim().toLowerCase();
        const news = await LiveNews.findById(req.params.id);

        if (!news) {
            return errHandler(res, "Live News not found", 404);
        }

        let image = news.image;
        let gallery = news.gallery || [];

        if (req.files?.image?.length) {
            await deleteFirebaseFile(news.image);
            image = await uploadToFirebase(req.files.image[0], "live-news/main");
        }

        if (req.files?.gallery?.length) {
            if (news.gallery?.length) {
                await Promise.all(news.gallery.map((img) => deleteFirebaseFile(img)));
            }
            gallery = await uploadMultipleImages(req.files.gallery, "live-news/gallery");
        }

        if (finalSlug && finalSlug !== news.slug) {
            const exists = await LiveNews.findOne({
                slug: finalSlug,
                _id: { $ne: news._id },
            });
            if (exists) {
                return errHandler(res, "Slug already exists", 400);
            }
        }

        let finalTags = news.tags;
        if (tags) {
            if (Array.isArray(tags)) {
                finalTags = tags;
            } else {
                try {
                    const parsed = JSON.parse(tags);
                    finalTags = Array.isArray(parsed) ? parsed : news.tags;
                } catch {
                    finalTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
                }
            }
        }

        news.title = title || news.title;
        news.slug = finalSlug || news.slug;
        news.description = description || news.description;
        news.category = category || news.category;
        news.subCategory = subCategory || news.subCategory;
        news.image = image;
        news.gallery = gallery;
        news.reportedBy = reportedBy || news.reportedBy;
        news.publishBy = publishBy || news.publishBy;
        news.tags = finalTags;

        if (status !== undefined) news.status = status;
        if (live !== undefined) news.live = live;

        await news.save();
        return responseHandler(res, news);
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== UPDATE A SPECIFIC TIMELINE UPDATE ====================
export const UpdateLiveNewsUpdate = async (req, res) => {
    try {
        const { title, description, postedBy } = req.body;
        const update = await LiveNewsUpdate.findById(req.params.id);
        if (!update) {
            return errHandler(res, "Live News Update not found", 404);
        }

        let image = update.image;
        let images = update.images || [];

        if (req.files?.image?.length) {
            await deleteFirebaseFile(update.image);
            image = await uploadToFirebase(req.files.image[0], "live-news/updates");
        }

        if (req.files?.images?.length) {
            if (update.images?.length) {
                await Promise.all(update.images.map((img) => deleteFirebaseFile(img)));
            }
            images = await uploadMultipleImages(req.files.images, "live-news/updates");
        }

        update.title = title || update.title;
        update.description = description || update.description;
        update.postedBy = postedBy || update.postedBy;
        update.image = image;
        update.images = images;

        await update.save();
        return responseHandler(res, update);
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== DELETE MAIN LIVE NEWS (+ all its updates) ====================
export const DeleteLiveNews = async (req, res) => {
    try {
        const news = await LiveNews.findById(req.params.id);
        if (!news) {
            return errHandler(res, "News not found", 404);
        }

        await deleteFirebaseFile(news.image);
        if (news.gallery?.length) {
            await Promise.all(news.gallery.map((img) => deleteFirebaseFile(img)));
        }

        const updates = await LiveNewsUpdate.find({ liveNewsId: news._id });
        for (const item of updates) {
            await deleteFirebaseFile(item.image);
            if (item.images?.length) {
                await Promise.all(item.images.map((img) => deleteFirebaseFile(img)));
            }
        }

        await LiveNewsUpdate.deleteMany({ liveNewsId: news._id });
        await LiveNews.findByIdAndDelete(news._id);

        return responseHandler(res, { message: "Live News Deleted Successfully" });
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};

// ==================== DELETE A SPECIFIC TIMELINE UPDATE ====================
export const DeleteLiveNewsUpdate = async (req, res) => {
    try {
        const update = await LiveNewsUpdate.findById(req.params.id);
        if (!update) {
            return errHandler(res, "Live News Update not found", 404);
        }

        await deleteFirebaseFile(update.image);
        if (update.images?.length) {
            await Promise.all(update.images.map((img) => deleteFirebaseFile(img)));
        }

        await LiveNewsUpdate.findByIdAndDelete(req.params.id);
        return responseHandler(res, { message: "Live News Update Deleted Successfully" });
    } catch (err) {
        return errHandler(res, err.message, 500);
    }
};