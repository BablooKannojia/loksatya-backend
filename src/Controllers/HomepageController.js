
import { Article, Content, SubCategory } from "../Models/ArticleSchema.js";
import { AdsS } from "../Models/AdsSchema.js";
import { flashnews } from "../Models/FlashSchema.js";
import { Video } from "../Models/videoSchema.js";
import { Photo } from "../Models/photoSchema.js";
import { Poll } from "../Models/PollSchema.js";
import { Story } from "../Models/StoriesSchema.js";
import { redisClient } from "../Config/redisClient.js";

// Cache TTL — kitni der tak purana data serve karte rahein
const TTL = {
  FLASH_NEWS: 60,   // 1 min  — ticker mein dikhta hai, fresh rehna chahiye
  BREAKING: 90,   // 1.5 min
  TOP_STORIES: 120,  // 2 min
  SLIDER: 180,  // 3 min
  LATEST: 180,  // 3 min
  VIDEOS: 300,  // 5 min
  PHOTOS: 300,  // 5 min
  STORIES: 300,  // 5 min
  POLLS: 300,  // 5 min
  ADS: 600,  // 10 min — ads rarely change
  CATEGORIES: 900,  // 15 min — category list stable rehti hai
  HOMEPAGE_FULL: 60,   // Full homepage cache — 1 min
};

const CACHE_KEY = "homepage:full";

// ─── Helper: lean article projection — sirf wahi fields jo frontend use karta hai ───
const ARTICLE_FIELDS = {
  _id: 1, title: 1, image: 1, slug: 1,
  newsType: 1, status: 1, topic: 1,
  subCategory: 1, createdAt: 1, priority: 1,
  slider: 1, fixedPosition: 1, type: 1,
};

// ─── Main Homepage Handler ────────────────────────────────────────────────────
export const getHomepageData = async (req, res) => {
  try {
    // 1. Cache check — agar 60 sec ke andar koi aa chuka hai toh wahi data wapis karo
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.json(cached);
    }

    // 2. Sab queries ek saath chalao — MongoDB ko parallel hit karo
    const [
      sliderRes,
      breakingRes,
      topStoriesRes,
      latestRes,
      priorityRes,
      generalRes,
      fixed1Res,
      fixed2Res,
      flashRes,
      videoRes,
      photoRes,
      storyRes,
      pollRes,
      adsTopRes,
      adsMidRes,
      adsBottomRes,
      articleTopRes,
      // categoryRes,
      // categoryArticleRes,
    ] = await Promise.allSettled([
      // Articles — 8 article queries
      Article.find({ status: "online", slider: true, type: "img" })
        .sort({ createdAt: -1 }).limit(8).select(ARTICLE_FIELDS).lean(),

      Article.find({ status: "online", newsType: "breakingNews", type: "img", priority: true })
        .sort({ createdAt: -1 }).limit(12).select(ARTICLE_FIELDS).lean(),

      Article.find({ status: "online", newsType: "topStories", type: "img", priority: true })
        .sort({ createdAt: -1 }).limit(10).select(ARTICLE_FIELDS).lean(),

      Article.find({ status: "online", newsType: "upload", type: "img", priority: true })
        .sort({ createdAt: -1 }).limit(14).select(ARTICLE_FIELDS).lean(),

      Article.find({ status: "online", priority: true })
        .sort({ createdAt: -1 }).limit(5).select(ARTICLE_FIELDS).lean(),

      Article.find({ type: "img" })
        .sort({ createdAt: -1 }).limit(6).select(ARTICLE_FIELDS).lean(),

      Article.find({ fixedPosition: 1, status: "online" })
        .sort({ fixedPosition: 1, createdAt: -1 }).limit(1).select(ARTICLE_FIELDS).lean(),

      Article.find({ fixedPosition: 2, status: "online" })
        .sort({ fixedPosition: 1, createdAt: -1 }).limit(1).select(ARTICLE_FIELDS).lean(),

      // Flash news
      flashnews.find({}).sort({ createdAt: -1 }).limit(20).lean(),

      // Videos
      Video.find({}).sort({ createdAt: -1 }).limit(6).lean(),

      // Photos
      Photo.find({}).sort({ createdAt: -1 }).limit(12).lean(),

      // Stories
      Story.find({}).sort({ createdAt: -1 }).limit(10).lean(),

      // Polls
      Poll.find({}).sort({ createdAt: -1 }).limit(5).lean(),

      // Ads — 3 queries
      AdsS.find({ active: true, side: "top" }).sort({ createdAt: -1 }).lean(),
      AdsS.find({ active: true, side: "mid" }).sort({ createdAt: -1 }).lean(),
      AdsS.find({ active: true, side: "bottom" }).sort({ createdAt: -1 }).lean(),

      // Hardcoded article ID (aapke code mein tha)
      Article.findById("6524337309c3cf5a3cca172a").select(ARTICLE_FIELDS).lean(),

      // Content.find({ type: "category" })
      //   .sort({ sequence: 1 })
      //   .lean(),

      // Article.aggregate([
      //   {
      //     $match: {
      //       status: "online",
      //       type: "img",
      //       priority: true,
      //     },
      //   },
      //   {
      //     $sort: {
      //       createdAt: -1,
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: "$topic",
      //       articles: {
      //         $push: {
      //           _id: "$_id",
      //           title: "$title",
      //           image: "$image",
      //           slug: "$slug",
      //           topic: "$topic",
      //           createdAt: "$createdAt",
      //         },
      //       },
      //     },
      //   },
      // ]),

    ]);



    // ─── Helper: settled value ya null ───
    const val = (r) => {
      if (!r) return null;
      return r.status === "fulfilled" ? r.value : null;
    };

    // ─── Process articles ───
    const sliderArticles = (val(sliderRes) || [])
      .map(addShareUrl)
      .filter((a) => a.status === "online");

    const breakingNews = (val(breakingRes) || []).map(addShareUrl);
    const topStories = (val(topStoriesRes) || [])
      .map(addShareUrl)
      .filter((t) => !sliderArticles.some((s) => s._id === t._id));
    const latestNews = (val(latestRes) || []).map(addShareUrl);
    const priorityArticles = (val(priorityRes) || []).map(addShareUrl);
    const generalArticles = (val(generalRes) || []).map(addShareUrl);

    const fixed1 = val(fixed1Res)?.[0] || null;
    const fixed2 = val(fixed2Res)?.[0] || null;

    // ─── Process flash news ───
    const flashNewsRaw = val(flashRes) || [];
    const flashNews = flashNewsRaw.filter((f) => f.status === "active");

    // ─── Process videos ───
    const videos = (val(videoRes) || []).filter((v) => v.status === true);

    // ─── Process photos ───
    const photos = (val(photoRes) || [])
      .filter((p) => p.status === true)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ─── Process stories ───
    const stories = (val(storyRes) || []).filter((s) => s.status === true);

    // ─── Process polls ───
    const polls = val(pollRes) || [];
    const latestPoll = polls.length ? polls[polls.length - 1] : null;

    // ─── Process ads — last active ad for each position ───
    const pickLastActive = (ads) =>
      (ads || []).filter((a) => a.active).at(-1) || null;

    const ads = {
      top: pickLastActive(val(adsTopRes)),
      mid: pickLastActive(val(adsMidRes)),
      bottom: pickLastActive(val(adsBottomRes)),
    };

    // ─── Article top (hardcoded ID) ───
    const articleTop = val(articleTopRes) || null;

    // ─── Mobile slider helpers (same data, different slices) ───
    const mobileSlider1 = breakingNews.slice(0, 8);
    const mobileSlider2 = sliderArticles;


    // const categories = val(categoryRes) || [];
    // const groupedArticles = val(categoryArticleRes) || [];

    // const articleMap = {};

    // groupedArticles.forEach(item => {
    //   articleMap[item._id] = item.articles.slice(0, 7).map(addShareUrl);
    // });

    // console.log("categories =>", categories);
    // console.log("groupedArticles =>", groupedArticles);

    // const homepageCategories = categories
    //   .map(cat => ({
    //     category: cat.text,
    //     imgData: articleMap[cat.text] || []
    //   }))
    //   .filter(cat => cat.imgData.length);

    // ─── Build response ───
    const response = {
      slider: sliderArticles,
      breakingNews,
      topStories,
      latestNews,
      priorityArticles,
      generalArticles,
      // categories: homepageCategories,
      fixedArticles: {
        first: fixed1,
        second: fixed2,
      },
      mobileSlider1,
      mobileSlider2,
      flashNews,
      videos,
      photos,
      stories,
      poll: latestPoll,
      ads,
      articleTop,
      _meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
      },
    };

    // ─── Cache karo ───
    await redisClient.set(CACHE_KEY, response, TTL.HOMEPAGE_FULL);

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(response);

  } catch (error) {
    console.error("Homepage API Error:", error);
    return res.status(500).json({
      message: "Homepage data fetch failed",
      error: process.env.ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── Helper: shareUrl add karo ───────────────────────────────────────────────
function addShareUrl(article) {
  return {
    ...article,
    shareUrl: `https://loksatya.com/details/${article.slug || article._id}?id=${article._id}`,
  };
}

// ─── Cache invalidate — jab bhi koi article publish ho ───────────────────────
// Isko ArticleController ke PostArticle/approvedArticle se call karo
export const invalidateHomepageCache = async () => {
  await redisClient.del(CACHE_KEY);
};


// ─── Categories with articles — alag endpoint ────────────────────────────────
// Pehle: 1 call for categories + N calls for each category = N+1 queries
// Ab: ek hi endpoint, MongoDB aggregation se sab
export const getCategoriesWithArticles = async (req, res) => {
  const CACHE_KEY_CAT = "homepage:categories";

  try {
    const cached = await redisClient.get(CACHE_KEY_CAT);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    // 1. Sari categories ek saath lao
    const categories = await Content.find({ type: "category" })
      .sort({ sequence: 1 })
      .lean();

    if (!categories.length) {
      return res.json([]);
    }

    // 2. Sab categories ke liye articles ek MongoDB call mein
    const categoryNames = categories.map((c) => c.text);

    const articlesByCategory = await Article.aggregate([
      {
        $match: {
          status: "online",
          type: "img",
          priority: true,
          topic: { $in: categoryNames },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$topic",
          articles: {
            $push: {
              _id: "$_id",
              title: "$title",
              image: "$image",
              slug: "$slug",
              newsType: "$newsType",
              topic: "$topic",
              createdAt: "$createdAt",
            },
          },
        },
      },
      {
        $project: {
          category: "$_id",
          imgData: { $slice: ["$articles", 7] }, // max 7 per category
        },
      },
    ]);

    // 3. Category sequence ke hisaab se sort karo
    const categoryMap = {};
    articlesByCategory.forEach((item) => {
      categoryMap[item.category] = item.imgData;
    });

    const result = categories
      .map((cat) => ({
        category: cat.text,
        imgData: categoryMap[cat.text] || [],
      }))
      .filter((c) => c.imgData.length > 0);

    await redisClient.set(CACHE_KEY_CAT, result, TTL.CATEGORIES);

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=900");
    return res.json(result);

  } catch (error) {
    console.error("Categories API Error:", error);
    return res.status(500).json({ message: "Categories fetch failed" });
  }
};

// GET /api/common
export const getCommonData = async (req, res) => {
  try {
    // Categories
    const categories = await Content.find({ type: "category" })
      .sort({ sequence: 1 })
      .select("text sequence -_id")
      .lean();


    // menuCategory
    const menuCategories = await Content.find({ type: "category" })
      .sort({ sequence: 1 })
      .select("_id text sequence")
      .lean();

    // menuSubCategory
    const allSubcategories = await SubCategory.find({})
      .select("_id category text")
      .lean();

    const categoryNames = categories.map((c) => c.text);
    const subcategoryMap = {};

    allSubcategories.forEach((item) => {
      if (!subcategoryMap[item.category]) {
        subcategoryMap[item.category] = [];
      }

      subcategoryMap[item.category].push({
        _id: item._id,
        text: item.text,
        category: item.category,
      });
    });

    const menu = menuCategories.map((item) => ({
      _id: item._id,
      text: item.text,
      sequence: item.sequence,
      subcategories: subcategoryMap[item.text] || [],
    }));

    // Sab categories ke latest 7 articles ek hi query me
    const articles = await Article.aggregate([
      {
        $match: {
          topic: { $in: categoryNames },
          type: "img",
          priority: true,
          status: "online",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: "$topic",
          articles: {
            $push: {
              _id: "$_id",
              title: "$title",
              slug: "$slug",
              image: "$image",
              topic: "$topic",
              createdAt: "$createdAt",
              newsType: "$newsType",
              status: "$status",
              priority: "$priority",
              type: "$type",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          data: {
            $slice: ["$articles", 7],
          },
        },
      },
    ]).allowDiskUse(true);

    const articleMap = {};
    articles.forEach((item) => {
      articleMap[item.category] = item.data.map((article) => ({
        ...article,
        shareUrl: `https://loksatya.com/details/${article.slug || article._id}?id=${article._id}`,
      }));
    });

    const response = categories.map((cat) => ({
      category: cat.text,
      sequence: cat.sequence,
      data: articleMap[cat.text] || [],
    }));


    return res.json({
      success: true,
      categories: response,
      menu,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch common data",
    });
  }
};