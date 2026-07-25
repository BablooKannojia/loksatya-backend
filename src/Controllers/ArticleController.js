import {
  Article,
  Content,
  Report,
  SubCategory,
} from "../Models/ArticleSchema.js";
import { User } from "../Models/UserSchema.js";
import { errHandler, responseHandler } from "../helper/response.js";
import { Storage } from "../Config/firebase.config.js";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { ObjectId } from "mongodb";
import { response } from "express";
import {translate} from '@vitalets/google-translate-api';
import { redisClient } from '../Config/redisClient.js';

const queryCache = new Map();
// const CACHE_TTL = 30000; // 30 seconds

// Cache TTL configurations
const CACHE_TTL = {
  SHORT: 60, // 1 minute for frequently changing data
  MEDIUM: 300, // 5 minutes for regular articles
  LONG: 1800, // 30 minutes for static content
};

const generateCacheKey = (prefix, query) => {
  const keyParams = {
    ...query,
    page: query.page || 1,
    limit: query.limit || 12
  };
  delete keyParams.pagenation; // Remove non-essential params
  return `${prefix}:${JSON.stringify(keyParams)}`;
};

const invalidateArticleCache = async (patterns = ['articles:*']) => {
  try {
    for (const pattern of patterns) {
      await redisClient.flushPattern(pattern);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

const getCachedQuery = (key) => {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedQuery = (key, data) => {
  queryCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Optimized fetch functions
const fetchSliderBreakingNews = async (limit, query) => {
  const cacheKey = `slider:${limit}:${JSON.stringify(query)}`;
  const cached = getCachedQuery(cacheKey);
  if (cached) return cached;

  try {
    // FIXED: Use the complete query including category filters
    const data = await Article.aggregate([
      { $match: { ...query, slider: true } }, // Include the original query filters
      { $sort: { createdAt: -1 } },
      { $limit: limit }
    ]).allowDiskUse(true);

    setCachedQuery(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching slider news:', error);
    throw error;
  }
};
const fetchPriortyArticles = async (limit, query) => {
  try {
    console.log('fetchPriortyArticles called with query:', JSON.stringify(query));
    
    // Ensure we're filtering by priority AND the original query
    const finalQuery = { 
      ...query, 
      priority: true 
    };
    console.log('Final priority query:', JSON.stringify(finalQuery));
    
    const data = await Article.find(finalQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .maxTimeMS(30000);
    
    console.log('Priority articles found:', data.length);
    data.forEach((article, index) => {
      console.log(`Article ${index + 1}:`, article.topic, '- Priority:', article.priority);
    });
    
    return data;
  } catch (error) {
    console.error('Error in fetchPriortyArticles:', error);
    throw error;
  }
};
const shareUrl = async (req, res) => {
  const { relocation, id } = req.query;
  
  if (relocation) {
    try {
      relocation = decodeURIComponent(relocation);
    } catch (err) {
      console.warn("⚠️ Relocation decode failed:", relocation);
    }
  }

  const isCrawler = (userAgent) => {
    const crawlers = [
      "WhatsApp", "facebookexternalhit", "Twitterbot", "LinkedInBot",
      "TelegramBot", "Slackbot", "Discordbot", "SkypeUriPreview",
      "Facebot", "facebookcatalog", "MetaInspector", "facebookplatform"
    ];
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return crawlers.some((crawler) => ua.includes(crawler.toLowerCase()));
  };

  const userAgent = req.headers["user-agent"] || "";
  const acceptHeader = req.headers["accept"] || "";

  console.log('🔍 Share URL Called');
  console.log('📱 User Agent:', userAgent);
  console.log('📄 Accept Header:', acceptHeader);
  console.log('🔗 Query Params:', { relocation, id });

  const isFacebookBot = userAgent.includes('facebookexternalhit') ||
    userAgent.includes('Facebot') ||
    acceptHeader.includes('text/html');

  if (isCrawler(userAgent) || isFacebookBot) {
    console.log('🤖 Social Media Crawler Detected:', userAgent);

    if (!id) {
      return res.status(400).send("Article ID is required");
    }

    try {
      const data = await Article.findById(id);
      if (!data) return res.status(404).send("Article not found");

      console.log('✅ Article found:', data.title);

      const plainDescription = data.discription
        ? data.discription.replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .substring(0, 155)
          .trim() + '...'
        : 'Stay updated with the latest news at Loksatya.';

      let imageUrl = data.image;
      if (imageUrl) {
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          const baseUrl = imageUrl.split('?')[0];
          imageUrl = baseUrl + '?alt=media';
        }
        if (!imageUrl.startsWith('http')) {
          imageUrl = `https://loksatya.com${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
        if (!imageUrl.startsWith('https://')) {
          imageUrl = imageUrl.replace('http://', 'https://');
        }
      } else {
        imageUrl = 'https://loksatya.com/assets/Logo-new-BNYCZvJK.PNG';
      }

      const shareTitle = (data.title || 'LokSatya News')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .substring(0, 60);

      const currentUrl = relocation || `https://loksatya.com/details/${data.slug || data._id}?id=${data._id}`;

      // 💡 Clean version for OG tags — hide admin subdomain
      const cleanUrl = currentUrl.replace('admin.loksatya.com', 'loksatya.com');

      const html = `
<!DOCTYPE html>
<html lang="hi" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${shareTitle}</title>
  <meta name="title" content="${shareTitle}">
  <meta name="description" content="${plainDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${cleanUrl}">
  <meta property="og:title" content="${shareTitle}">
  <meta property="og:description" content="${plainDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:site_name" content="LokSatya News">
  <meta property="og:locale" content="hi_IN">
  <meta property="article:published_time" content="${data.createdAt}">
  <meta property="article:author" content="${data.reportedBy || 'LokSatya'}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${cleanUrl}">
  <meta property="twitter:title" content="${shareTitle}">
  <meta property="twitter:description" content="${plainDescription}">
  <meta property="twitter:image" content="${imageUrl}">
  <meta property="twitter:site" content="@LokSatyaNews">
  <meta property="twitter:creator" content="@LokSatyaNews">

  <meta name="author" content="${data.reportedBy || 'LokSatya'}">
  <link rel="canonical" href="${cleanUrl}">
</head>
<body>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "${shareTitle}",
    "description": "${plainDescription}",
    "image": "${imageUrl}",
    "datePublished": "${data.createdAt}",
    "dateModified": "${data.updatedAt}",
    "author": { "@type": "Person", "name": "${data.reportedBy || 'LokSatya'}" },
    "publisher": {
      "@type": "Organization",
      "name": "LokSatya News",
      "logo": {
        "@type": "ImageObject",
        "url": "https://loksatya.com/assets/Logo-new-BNYCZvJK.PNG"
      }
    }
  }
  </script>

  <div style="text-align:center; padding:20px; font-family:Arial,sans-serif;">
    <h1>${shareTitle}</h1>
    <img src="${imageUrl}" alt="${shareTitle}" style="max-width:100%; height:auto; margin:20px 0;">
    <p>${plainDescription}</p>
    <p><a href="${cleanUrl}">Read full article on LokSatya</a></p>
  </div>

  <script>
    setTimeout(() => { window.location.href = "${currentUrl}"; }, 1000);
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Vary', 'User-Agent, Accept');

      res.send(html);

    } catch (error) {
      console.error("❌ Database Error:", error);
      if (relocation) {
        res.redirect(302, relocation);
      } else {
        res.status(500).send(`<html><body><h1>Server Error</h1></body></html>`);
      }
    }
  } else {
    console.log('👤 Regular user detected, redirecting...');
    if (relocation) res.redirect(302, relocation);
    else res.redirect(302, 'https://loksatya.com');
  }
};
const imageUpload = async (req, res) => {
  const metadata = {
    contentType: req.file.mimetype,
  };
  const storageRef = ref(
    Storage,
    `uploads/${req.file.fieldname + "_" + Date.now()}`
  );
  await uploadBytesResumable(storageRef, req.file.buffer, metadata).then(
    (snap) => {
      getDownloadURL(storageRef).then((url) => {
        responseHandler(res, { image: url });
      });
    }
  );
};

const getArticle = async (req, res) => {
  try {
    console.time('getArticle_execution');

    // Light headers only
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");

    const queryParams = { ...req.query };
    console.log("Query parameters:", queryParams);

    // ✅ FIXED: Better page parsing
    let currentPage = 1;
    if (queryParams.page && !isNaN(parseInt(queryParams.page))) {
      currentPage = Math.max(1, parseInt(queryParams.page));
    }

    // ✅ FIXED: Skip cache for dynamic queries completely
    const skipCache = queryParams.pagenation === "true" || 
                     queryParams.search || 
                     queryParams.keyword || 
                     queryParams.category || 
                     queryParams.topic ||
                     queryParams.fixedPosition;

    const cacheKey = generateCacheKey('articles', queryParams);
    
    // ✅ FIXED: Only cache for simple queries
    if (!skipCache) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('Serving from cache:', cacheKey);
        console.timeEnd('getArticle_execution');
        return responseHandler(res, cachedData);
      }
    }

    // ✅ FIXED: Build query efficiently
    const query = {};
    
    // Basic filters
    if (queryParams.approved !== undefined) {
      query.approved = queryParams.approved === "true";
    }

    // ✅ FIXED: Proper fixed position handling
    if (queryParams.fixedPosition) {
      const fixedPos = Number(queryParams.fixedPosition);
      if (!isNaN(fixedPos) && fixedPos > 0) {
        query.fixedPosition = fixedPos;
      }
    }

    // ID handling
    if (queryParams.id) {
      try {
        query._id = queryParams.id;
      } catch (error) {
        return errHandler(res, "Invalid ID format", 400);
      }
    }

    // Simple filters
    if (queryParams.status) query.status = queryParams.status;
    if (queryParams.excludeId) query._id = { $ne: queryParams.excludeId };
    if (queryParams.reportedBy) query.reportedBy = queryParams.reportedBy;
    if (queryParams.publishBy) query.publishBy = queryParams.publishBy;
    if (queryParams.newsType) query.newsType = queryParams.newsType;
    if (queryParams.type) query.type = queryParams.type;

    // ✅ FIXED: Date range - simplified
    if (queryParams.date && queryParams.date.includes(",")) {
      const [start, end] = queryParams.date.split(",");
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (!isNaN(startDate) && !isNaN(endDate)) {
        endDate.setHours(23, 59, 59, 999);
        query.date = { $gte: startDate, $lte: endDate };
      }
    }

    // ✅ FIXED: Text search - optimized with AND logic for same values
    const textConditions = [];
    
    // If all search parameters have the same value, use AND logic
    const searchValues = [
      queryParams.topic,
      queryParams.category, 
      queryParams.search,
      queryParams.keyword
    ].filter(Boolean);
    
    const allSameValue = searchValues.length > 0 && 
                        new Set(searchValues.map(v => v.trim())).size === 1;

    if (allSameValue) {
      // All search parameters have the same value - use AND across fields
      const searchTerm = searchValues[0].trim();
      const regex = new RegExp(searchTerm, "i");
      
      query.$and = [
        { $or: [
          { topic: regex },
          { category: regex },
          { subCategory: regex },
          { title: regex }
        ]}
      ];
      
      // Also include specific field matches if provided
      if (queryParams.topic) {
        query.$and.push({ topic: regex });
      }
      if (queryParams.category) {
        query.$and.push({ topic: regex }); // Note: you're mapping category to topic field
      }
      if (queryParams.subCategory) {
        query.$and.push({ subCategory: regex });
      }
    } else {
      // Different values - use OR logic as before
      if (queryParams.topic) {
        textConditions.push({ topic: new RegExp(queryParams.topic.trim(), "i") });
      }
      if (queryParams.category) {
        textConditions.push({ topic: new RegExp(queryParams.category.trim(), "i") });
      }
      if (queryParams.subCategory) {
        textConditions.push({ subCategory: new RegExp(queryParams.subCategory.trim(), "i") });
      }
      if (queryParams.search) {
        textConditions.push({ title: new RegExp(queryParams.search.trim(), "i") });
      }
      if (queryParams.keyword) {
        const regex = new RegExp(queryParams.keyword.trim(), "i");
        textConditions.push(
          { title: regex },
          { topic: regex },
          { subCategory: regex }
        );
      }

      if (textConditions.length > 0) {
        query.$or = textConditions;
      }
    }

    console.log("Final query:", JSON.stringify(query, null, 2));

    // ✅ FIXED: Special queries with timeout
    const pageSize = Math.min(parseInt(queryParams.limit) || 12, 50);
    const skip = (currentPage - 1) * pageSize;

    // Handle special queries first
    if (queryParams.slider === "true") {
      const sliderLimit = Math.min(Number(queryParams.limit) || 4, 20);
      const data = await fetchSliderBreakingNews(sliderLimit, query);
      console.timeEnd('getArticle_execution');
      return responseHandler(res, data);
    }

    if (queryParams.priority === "true") {
      const priorityLimit = Math.min(Number(queryParams.limit) || 6, 20);
      const data = await fetchPriortyArticles(priorityLimit, query);
      console.timeEnd('getArticle_execution');
      return responseHandler(res, data);
    }

    // ✅ FIXED: Main query with optimized sorting
    let sortCriteria = { createdAt: -1 };
    
    if (queryParams.fixedPosition) {
      sortCriteria = { fixedPosition: 1, createdAt: -1 };
    }

    // Pagination handling
    if (queryParams.pagenation === "true") {
      const [data, total] = await Promise.all([
        Article.find(query)
          .sort(sortCriteria)
          .skip(skip)
          .limit(pageSize)
          .lean()
          .maxTimeMS(10000),
        Article.countDocuments(query).maxTimeMS(5000),
      ]);

      const updatedData = data.map((item) => ({
        ...item,
        shareUrl: `https://loksatya.com/details/${item.slug || item._id}?id=${item._id}`,
      }));

      const result = {
        data: updatedData,
        total,
        limit: pageSize,
        page: currentPage,
        pages: Math.ceil(total / pageSize),
        hasNext: currentPage < Math.ceil(total / pageSize),
        hasPrev: currentPage > 1,
      };

      if (!skipCache) {
        await redisClient.set(cacheKey, result, 300);
      }
      
      console.timeEnd('getArticle_execution');
      return responseHandler(res, result);
    } else {
      const data = await Article.find(query)
        .sort(sortCriteria)
        .skip(skip)
        .limit(pageSize)
        .lean()
        .maxTimeMS(10000);

      const updatedData = data.map((item) => ({
        ...item,
        shareUrl: `https://loksatya.com/details/${item.slug || item._id}?id=${item._id}`,
      }));

      if (!skipCache) {
        await redisClient.set(cacheKey, updatedData, 300);
      }
      
      console.timeEnd('getArticle_execution');
      return responseHandler(res, updatedData);
    }
  } catch (error) {
    console.timeEnd('getArticle_execution');
    console.error("Error in getArticle:", error);
    return errHandler(
      res,
      {
        message: "Failed to fetch articles",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      500
    );
  }
};

const DeleteArticle = (req, res) => {
  const { id } = req.query;
  // console.log(id);
  Article.findByIdAndDelete({ _id: id }).then((data) => {
    responseHandler(res, data);
  });
};
const ReportArticle = (req, res) => {
  const { adminId, userId, question, articleId } = req.body;
  // console.log(req.body);
  Report.create({ adminId, userId, articleId, question })
    .then(async (data) => {
      await Article.findByIdAndUpdate(
        { _id: articleId },
        { approved: true },
        { new: true }
      );
      responseHandler(res, data);
    })
    .catch((err) => {
      errHandler(res, err, 404);
    });
};
const GetReportArticle = (req, res) => {
  const { adminId, userId } = req.query;
  let obj = {};
  if (adminId) {
    obj.adminId = adminId;
  }
  if (userId) {
    obj.userId = userId;
  }
  Report.find(obj).then(async (data) => {
    responseHandler(res, data);
  });
};
const answerReportArticle = (req, res) => {
  const { id, answer } = req.body;
  Report.findByIdAndUpdate({ _id: id }, { answer }, { new: true }).then(
    async (data) => {
      responseHandler(res, data);
    }
  );
};
const DashboardReport = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    // If date query parameter is provided, attempt to construct date filtering criteria
    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        // Construct date filtering criteria only if both startDate and endDate are valid dates
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // Find all reports and apply date filtering criteria if provided
    const allReports = await Report.find(dateFilter);

    // Count the number of reports created today
    const todayData = await Report.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    });

    // Count of active reports
    const activeCount = allReports.length;

    // Inactive count is always 0 for reports
    const inactiveCount = 0;

    res.json({ activeCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const adminGetArticle = (req, res) => {
  const { id } = req.params;
  User.findOne({ _id: id, role: "admin" })
    .then(() => {
      Article.find({ approved: false }).then((data) => {
        responseHandler(res, data);
      });
    })
    .catch(() => {
      errHandler(res, "not Found", 404);
    });
};
const PostArticle = async (req, res) => {
  const {
    title,
    discription,
    topic,
    keyWord,
    language,
    reportedBy,
    publishBy,
    newsType,
    image,
    type,
    subCategory,
    acsses,
    comment,
    slug,
    priority,
    slider,
    publishAt, // This should already be in UTC from frontend
    status = 'online'
  } = req.body;

  const { id } = req.params;
  
  let translatedTopic = topic;
  try {
    const result = await translate(topic, { from: 'hi', to: 'en' });
    translatedTopic = result.text.toLowerCase(); 
  } catch (translationError) {
    console.error("Translation error, using original text:", translationError);
  }
  
  const customId = translatedTopic + Date.now().toString().substring(0, 10);

  // ✅ FIXED: Use publishAt directly as UTC, no conversion needed
  let finalPublishAt;
  let finalStatus = status;

  if (publishAt) {
    const publishDate = new Date(publishAt);
    
    if (publishDate > new Date()) {
      finalStatus = 'scheduled';
      finalPublishAt = publishDate; // Already in UTC
    } else {
      finalStatus = 'online';
      finalPublishAt = new Date();
    }
  } else {
    finalPublishAt = new Date();
  }

  Article.create({
    _id: customId,
    UserID: id,
    title,
    discription,
    topic,
    keyWord,
    language,
    reportedBy,
    publishBy,
    newsType,
    image,
    date: new Date().toISOString().split('T')[0],
    type,
    subCategory,
    acsses,
    comment,
    slug,
    priority,
    slider,
    publishAt: finalPublishAt,
    status: finalStatus,
    createdAt: new Date(),
    updatedAt: new Date()
  })
    .then((data) => {
      responseHandler(res, data);
    })
    .catch((err) => {
      errHandler(res, JSON.stringify(err), 403);
    });
};
const approvedArticle = (req, res) => {
  let { id } = req.params;
  let body = req.body;

  Article.findByIdAndUpdate({ _id: id }, body, { new: true })
    .then((data) => {
      responseHandler(res, {
        data,
      });
    })
    .catch((err) => {
      errHandler(res, 5, 409);
    });
};

const ArticleContent = (req, res) => {
  const { id } = req.query; // `id` is the adminId
  const { text, type, sequence } = req.body;

  // Validation for type
  if (!["tag", "category"].includes(type)) {
    return errHandler(res, "Invalid type. Must be 'tag' or 'category'.", 400);
  }

  // Validation for sequence (only for 'category')
  if (type === "category" && (sequence === undefined || sequence === null)) {
    return errHandler(res, "Sequence is required for type 'category'.", 400);
  }

  // Check if a category with the same sequence already exists (only for category)
  if (type === "category") {
    Content.findOne({ type: "category", sequence })
      .then((existingCategory) => {
        if (existingCategory) {
          return errHandler(
            res,
            "A category with this sequence already exists.",
            400
          );
        }

        // Prepare content data for category
        const contentData = {
          type,
          adminId: id,
          text,
          sequence,
        };

        // Create category content
        Content.create(contentData)
          .then((data) => {
            responseHandler(res, data);
          })
          .catch((error) => {
            console.error("Error creating content:", error);
            errHandler(res, "Content was not created", 403);
          });
      })
      .catch((error) => {
        console.error("Error checking for existing category:", error);
        errHandler(res, "Error checking for existing category", 500);
      });
  } else if (type === "tag") {
    // Check if a tag with the same text already exists
    Content.findOne({ type: "tag", text })
      .then((existingTag) => {
        if (existingTag) {
          return errHandler(res, "A tag with this text already exists.", 400);
        }

        // Prepare content data for tag
        const contentData = {
          type,
          adminId: id,
          text,
        };

        // Create tag content
        Content.create(contentData)
          .then((data) => {
            responseHandler(res, data);
          })
          .catch((error) => {
            console.error("Error creating content:", error);
            errHandler(res, "Content was not created", 403);
          });
      })
      .catch((error) => {
        console.error("Error checking for existing tag:", error);
        errHandler(res, "Error checking for existing tag", 500);
      });
  }
};

const ArticleContentSequenceEdit = async (req, res) => {
  const { id, sequence } = req.body;

  try {
    // Fetch the content to determine its type
    const content = await Content.findById(id);

    if (!content) {
      return errHandler(res, "Content not found", 404);
    }

    // Sequence editing is only allowed for 'category'
    if (content.type === "tag") {
      return errHandler(res, "Sequence cannot be edited for type 'tag'.", 400);
    }

    if (content.type === "category") {
      // Validate sequence for 'category'
      if (sequence === undefined || sequence === null) {
        return errHandler(
          res,
          "Sequence is required for type 'category'.",
          400
        );
      }

      // Check for duplicate sequence in the database
      const duplicateContent = await Content.findOne({
        type: "category",
        sequence: sequence,
        _id: { $ne: id }, // Exclude the current content
      });

      if (duplicateContent) {
        return errHandler(
          res,
          "Sequence already exists for this category.",
          409
        );
      }

      // Update the sequence
      content.sequence = sequence;

      const updatedContent = await content.save();
      return responseHandler(res, updatedContent);
    }
  } catch (error) {
    console.error("Error editing content:", error);
    return errHandler(res, "Content was not edited", 500);
  }
};

const ArticleContentDelete = (req, res) => {
  const { id } = req.params;
  console.log(id);
  Content.findByIdAndDelete({ _id: id })
    .then((data) => {
      responseHandler(res, {
        message: "Content Deleted Successfully",
        data: data,
        status: 200,
      });
    })
    .catch(() => {
      errHandler(res, "Article Content was not Deleted", 403);
    });
};
// const ArticleContentGet = async (req, res) => {
//   try {
//     const { id, adminId, type, page = 1, limit = 50 } = req.query;
    
//     // Build query efficiently
//     const query = {};
//     if (id) query._id = id;
//     if (type) query.type = type;
//     if (adminId) query.adminId = adminId;

//     // Use lean() and projection for better performance
//     const data = await Content.find(query)
//       .select('type text sequence adminId createdAt')
//       .lean()
//       .maxTimeMS(10000); // Add timeout

//     responseHandler(res, data);
//   } catch (error) {
//     console.error('Error in ArticleContentGet:', error);
//     errHandler(res, "Failed to fetch content", 500);
//   }
// };
const ArticleContentGet = async (req, res) => {
  try {
    const {
      id,
      adminId,
      type,
      page = 1,
      limit = 50,
      search = "",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const query = {};

    if (id) query._id = id;
    if (type) query.type = type;
    if (adminId) query.adminId = adminId;

    // Search only when requested
    if (search.trim()) {
      query.text = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const [data, total] = await Promise.all([
      Content.find(query)
        .select("type text sequence adminId createdAt")
        .sort({ text: 1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()
        .maxTimeMS(10000),

      Content.countDocuments(query),
    ]);

    responseHandler(res, {
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
        hasNextPage: pageNumber * limitNumber < total,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("Error in ArticleContentGet:", error);
    errHandler(res, "Failed to fetch content", 500);
  }
};
const DashboardContent = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // ⚡ Direct count instead of fetching all docs
    const categoryCount = await Content.countDocuments(dateFilter);

    const inactiveCount = 0;

    const today = new Date();
    const todayData = await Content.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    res.json({ activeCount: categoryCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const DashboardSubCategory = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    // If date query parameter is provided, attempt to construct date filtering criteria
    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        // Construct date filtering criteria only if both startDate and endDate are valid dates
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // Find all subcategories and apply date filtering criteria if provided
    const allSubCategories = await SubCategory.find(dateFilter);

    // Count of subcategories
    const subCategoryCount = allSubCategories.length;

    // Inactive count is always 0
    const inactiveCount = 0;

    // Today's data count
    const today = new Date();
    const todayData = await SubCategory.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    res.json({ activeCount: subCategoryCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Category Get and Post
const createSubCategory = async (req, res) => {
  let body = req.body;
  console.log(body);
  if (SubCategory && (await SubCategory.findOne({ text: body.text }))) {
    errHandler(res, "Sub Category ALready Axist", 401);
    return;
  }
  SubCategory.create(body)
    .then((data) => {
      responseHandler(res, data);
    })
    .catch((err) => {
      // console.log(err);
      errHandler(res, "Sub Category Was Not Create", 403);
    });
};
const getSubCategory = async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = {};
    if (category) query.category = category;

    const data = await SubCategory.find(query)
      .select('category text adminId createdAt')
      .lean()
      .maxTimeMS(10000);

    responseHandler(res, data);
  } catch (error) {
    console.error('Error in getSubCategory:', error);
    errHandler(res, "Failed to fetch subcategories", 500);
  }
};

const dashBoardBreakingNews = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    // If date query parameter is provided, attempt to construct date filtering criteria
    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        // Construct date filtering criteria only if both startDate and endDate are valid dates
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // Find all articles where newsType is "breakingNews" and apply date filtering criteria if provided
    const breakingNewsArticles = await Article.find({
      newsType: "breakingNews",
      ...dateFilter,
    });

    // Count the number of breaking news articles created today
    const today = new Date();
    const todayData = await Article.countDocuments({
      newsType: "breakingNews",
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    // Find active articles (status: "online")
    const activeArticles = breakingNewsArticles.filter(
      (article) => article.status === "online"
    );

    // Find inactive articles (status: "offline")
    const inactiveArticles = breakingNewsArticles.filter(
      (article) => article.status === "offline"
    );

    // Count of all articles where breaking news has status "online"
    const activeCount = activeArticles.length;

    // Count of all articles where breaking news has status "offline"
    const inactiveCount = inactiveArticles.length;

    res.json({ activeCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const dashBoardAllStats = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (d) => !isNaN(new Date(d).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // 🚀 Single aggregation query (super fast)
    const result = await Article.aggregate([
      {
        $match: {
          newsType: { $in: ["breakingNews", "topStories", "upload"] },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: { newsType: "$newsType", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Prepare stats object
    const stats = {
      breakingNews: { activeCount: 0, inactiveCount: 0, todayData: 0 },
      topStories: { activeCount: 0, inactiveCount: 0, todayData: 0 },
      upload: { activeCount: 0, inactiveCount: 0, todayData: 0 },
    };

    // Fill active/inactive counts
    result.forEach((r) => {
      const { newsType, status } = r._id;
      if (!stats[newsType]) return;

      if (status === "online") stats[newsType].activeCount = r.count;
      if (status === "offline") stats[newsType].inactiveCount = r.count;
    });

    // 🚀 Parallel counts for today
    const [breakingToday, topStoriesToday, uploadToday] = await Promise.all([
      Article.countDocuments({
        newsType: "breakingNews",
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
      Article.countDocuments({
        newsType: "topStories",
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
      Article.countDocuments({
        newsType: "upload",
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
    ]);

    stats.breakingNews.todayData = breakingToday;
    stats.topStories.todayData = topStoriesToday;
    stats.upload.todayData = uploadToday;

    res.json(stats);
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ message: err.message });
  }
};
const dashBoardTopStories = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (d) => !isNaN(new Date(d).getTime());
      if (isValidDate(startDate) && isValidDate(endDate)) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const result = await Article.aggregate([
      {
        $match: {
          newsType: "topStories",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Default counts
    let activeCount = 0;
    let inactiveCount = 0;

    result.forEach((r) => {
      if (r._id === "online") activeCount = r.count;
      if (r._id === "offline") inactiveCount = r.count;
    });

    const todayData = await Article.countDocuments({
      newsType: "topStories",
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    res.json({ activeCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const dashBoardUpload = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (d) => !isNaN(new Date(d).getTime());
      if (isValidDate(startDate) && isValidDate(endDate)) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const result = await Article.aggregate([
      {
        $match: {
          newsType: "upload",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let activeCount = 0;
    let inactiveCount = 0;

    result.forEach((r) => {
      if (r._id === "online") activeCount = r.count;
      if (r._id === "offline") inactiveCount = r.count;
    });

    const todayData = await Article.countDocuments({
      newsType: "upload",
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    res.json({ activeCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const dashBoardCategoryArticles = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");
      const isValidDate = (dateString) =>
        !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    // Fetch all distinct categories
    const categories = await Content.find({ type: "category" });

    // Prepare result object
    const categoryCounts = {};

    // Loop categories and do optimized counting
    for (const category of categories) {
      const query = { topic: category.text, ...dateFilter };

      // ⚡ Use countDocuments instead of fetching all docs
      const activeCount = await Article.countDocuments({
        ...query,
        status: "online",
      });

      const inactiveCount = await Article.countDocuments({
        ...query,
        status: "offline",
      });

      const today = new Date();
      const todayData = await Article.countDocuments({
        topic: category.text,
        newsType: "topStories",
        createdAt: {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999)),
        },
      });

      categoryCounts[category.text] = {
        activeCount,
        inactiveCount,
        todayData,
      };
    }

    res.json(categoryCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Slider fix BAbloo
const clearFixedPosition = async (req, res) => {
  try {
    const { position } = req.body;
    
    // Validate position
    if (![1, 2].includes(position)) {
      return res.status(400).json({ message: "Invalid position. Must be 1 or 2" });
    }

    // Find and clear the article in this position
    await Article.findOneAndUpdate(
      { fixedPosition: position },
      { $unset: { fixedPosition: 1 } },
      { new: true }
    );

    res.status(200).json({ message: `Position ${position} cleared successfully` });
  } catch (error) {
    console.error("Error clearing fixed position:", error);
    res.status(500).json({ message: "Failed to clear fixed position" });
  }
};
// Set an article to a fixed position
const setFixedPosition = async (req, res) => {
  try {
    const { articleId, position } = req.body;
    
    // Validate position
    if (![1, 2].includes(position)) {
      return res.status(400).json({ message: "Invalid position. Must be 1 or 2" });
    }

    // Check if this article is already in another position
    const currentArticle = await Article.findById(articleId);
    if (currentArticle?.fixedPosition && currentArticle.fixedPosition !== position) {
      return res.status(400).json({ 
        message: `Article is already in position ${currentArticle.fixedPosition}. Clear it first.` 
      });
    }

    // First clear any existing article in this position
    await Article.findOneAndUpdate(
      { fixedPosition: position },
      { $unset: { fixedPosition: 1 } }
    );

    // Then set the new article to this position
    const updatedArticle = await Article.findByIdAndUpdate(
      articleId,
      { fixedPosition: position },
      { new: true }
    );

    if (!updatedArticle) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.status(200).json(updatedArticle);
  } catch (error) {
    console.error("Error setting fixed position:", error);
    res.status(500).json({ message: "Failed to set fixed position" });
  }
};
// Get articles with fixed positions
const getFixedPositionArticles = async (req, res) => {
  try {
    const articles = await Article.find({
      fixedPosition: { $in: [1, 2] }
    }).sort({ fixedPosition: 1 });

    const result = {
      first: articles.find(article => article.fixedPosition === 1) || null,
      second: articles.find(article => article.fixedPosition === 2) || null
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching fixed position articles:", error);
    res.status(500).json({ message: "Failed to fetch fixed position articles" });
  }
};

const addSliderOrder = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Article id is required",
      });
    }

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Already assigned check
    if (
      article.sliderOrder !== null &&
      article.sliderOrder !== undefined &&
      typeof article.sliderOrder === "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Article already assigned a slider position",
      });
    }

    // ✅ FIX: max nikalo, count nahi
    const maxResult = await Article.aggregate([
      { $match: { sliderOrder: { $type: "number" } } }, // sirf numeric values
      { $group: { _id: null, max: { $max: "$sliderOrder" } } },
    ]);

    const currentMax = maxResult.length > 0 ? maxResult[0].max : 0;

    // Total kitne slider mein hain wo bhi count karlo limit ke liye
    const total = await Article.countDocuments({
      sliderOrder: { $type: "number" },
    });

    console.log("CURRENT MAX:", currentMax, "TOTAL:", total);

    if (total >= 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum 4 slider articles allowed",
      });
    }

    const nextOrder = currentMax + 1;

    const updatedArticle = await Article.findByIdAndUpdate(
      id,
      {
        $set: {
          slider: true,
          sliderOrder: nextOrder,
        },
      },
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      data: updatedArticle,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
const getSliderArticles = async (req, res) => {
  try {
    const articles = await Article.find({
      sliderOrder: { $type: "number" },
      status: "online",
    })
      .select("_id title image slug sliderOrder topic publishAt priority")
      .sort({ sliderOrder: 1 })
      .lean();

    return res.json({ success: true, data: articles });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
const updateSliderOrder = async (req, res) => {
  try {
    const { id, sliderOrder } = req.body;

    if (!id || !sliderOrder) {
      return res.status(400).json({
        success: false,
        message: "id and sliderOrder are required",
      });
    }

    if (sliderOrder < 1 || sliderOrder > 4) {
      return res.status(400).json({
        success: false,
        message: "sliderOrder must be between 1 and 4",
      });
    }

    const current = await Article.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    if (current.sliderOrder == null) {
      return res.status(400).json({
        success: false,
        message: "Article is not in slider",
      });
    }

    const oldOrder = current.sliderOrder;

    if (oldOrder === sliderOrder) {
      return res.json({
        success: true,
        message: "No changes",
      });
    }

    // Move Down
    if (oldOrder < sliderOrder) {
      await Article.updateMany(
        {
          sliderOrder: {
            $gt: oldOrder,
            $lte: sliderOrder,
          },
        },
        {
          $inc: {
            sliderOrder: -1,
          },
        }
      );
    }

    // Move Up
    else {
      await Article.updateMany(
        {
          sliderOrder: {
            $gte: sliderOrder,
            $lt: oldOrder,
          },
        },
        {
          $inc: {
            sliderOrder: 1,
          },
        }
      );
    }

    current.sliderOrder = sliderOrder;
    await current.save();

    const data = await Article.find({
      sliderOrder: { $type: "number" },
    })
      .select("_id title sliderOrder")
      .sort({ sliderOrder: 1 });

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
const removeSlider = async (req, res) => {
  try {
    const { id } = req.body;

    await Article.findByIdAndUpdate(id, {
      $unset: { sliderOrder: "" },
      $set: { slider: false },
    });

    const sliders = await Article.find({
      sliderOrder: { $type: "number" },
    }).sort({ sliderOrder: 1 });

    for (let i = 0; i < sliders.length; i++) {
      sliders[i].sliderOrder = i + 1;
      await sliders[i].save();
    }

    return res.json({
      success: true,
      message: "Removed Successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export {
  // Slider fix Babloo
  clearFixedPosition,
  setFixedPosition,
  getFixedPositionArticles,
  updateSliderOrder,
  addSliderOrder,
  removeSlider,
  getSliderArticles,
  getArticle,
  adminGetArticle,
  PostArticle,
  approvedArticle,
  DeleteArticle,
  imageUpload,
  ReportArticle,
  DashboardReport,
  GetReportArticle,
  answerReportArticle,
  ArticleContent,
  ArticleContentSequenceEdit,
  ArticleContentDelete,
  ArticleContentGet,
  createSubCategory,
  getSubCategory,
  dashBoardBreakingNews,
  dashBoardTopStories,
  DashboardContent,
  DashboardSubCategory,
  dashBoardUpload,
  dashBoardCategoryArticles,
  shareUrl,
};