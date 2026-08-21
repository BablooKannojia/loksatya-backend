import { User } from "../Models/UserSchema.js";
import { Article } from "../Models/ArticleSchema.js";
import { AdsS } from "../Models/AdsSchema.js";
import { flashnews } from "../Models/FlashSchema.js";
import { Story } from "../Models/StoriesSchema.js";
import { Video } from "../Models/videoSchema.js";
import { Photo } from "../Models/photoSchema.js";
import { Comment } from "../Models/CommentSchema.js";
import { Live } from "../Models/LiveSchema.js";
import { Poll } from "../Models/PollSchema.js";
import { Report } from "../Models/ArticleSchema.js";
import { Content } from "../Models/ArticleSchema.js";
import { SubCategory } from "../Models/ArticleSchema.js";
import { LiveNews } from "../Models/LiveNewsSchema.js";

export const Dashboard = async (req, res) => {
  try {
    const { date } = req.query;

    let dateFilter = {};

    if (date) {
      const [startDate, endDate] = date.split(",");

      if (!isNaN(new Date(startDate)) && !isNaN(new Date(endDate))) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayFilter = {
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    };

    const [
      users,
      breaking,
      topStories,
      uploads,
      ads,
      flash,
      stories,
      videos,
      photos,
      comments,
      lives,
      polls,
      livenews,
      reports,
      categories,
      subCategories,
    ] = await Promise.all([

      // USERS
      Promise.all([
        User.countDocuments({ registerd: true, ...dateFilter }),
        User.countDocuments({ registerd: false, ...dateFilter }),
        User.countDocuments(todayFilter),
      ]),

      // BREAKING
      Promise.all([
        Article.countDocuments({
          newsType: "breakingNews",
          status: "online",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "breakingNews",
          status: "offline",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "breakingNews",
          ...todayFilter,
        }),
      ]),

      // TOP STORIES
      Promise.all([
        Article.countDocuments({
          newsType: "topStories",
          status: "online",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "topStories",
          status: "offline",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "topStories",
          ...todayFilter,
        }),
      ]),

      // UPLOAD
      Promise.all([
        Article.countDocuments({
          newsType: "upload",
          status: "online",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "upload",
          status: "offline",
          ...dateFilter,
        }),
        Article.countDocuments({
          newsType: "upload",
          ...todayFilter,
        }),
      ]),

      // ADS
      Promise.all([
        AdsS.countDocuments({ active: true, ...dateFilter }),
        AdsS.countDocuments({ active: false, ...dateFilter }),
        AdsS.countDocuments(todayFilter),
      ]),

      // FLASH
      Promise.all([
        flashnews.countDocuments({ status: "active", ...dateFilter }),
        flashnews.countDocuments({ status: "inactive", ...dateFilter }),
        flashnews.countDocuments(todayFilter),
      ]),

      // STORIES
      Promise.all([
        Story.countDocuments({ status: true, ...dateFilter }),
        Story.countDocuments({ status: false, ...dateFilter }),
        Story.countDocuments(todayFilter),
      ]),

      // VIDEOS
      Promise.all([
        Video.countDocuments({ status: true, ...dateFilter }),
        Video.countDocuments({ status: false, ...dateFilter }),
        Video.countDocuments(todayFilter),
      ]),

      // PHOTOS
      Promise.all([
        Photo.countDocuments({ status: true, ...dateFilter }),
        Photo.countDocuments({ status: false, ...dateFilter }),
        Photo.countDocuments(todayFilter),
      ]),

      // COMMENTS
      Promise.all([
        Comment.countDocuments(dateFilter),
        Promise.resolve(0),
        Comment.countDocuments(todayFilter),
      ]),

      // LIVE
      Promise.all([
        Live.countDocuments(dateFilter),
        Promise.resolve(0),
        Live.countDocuments(todayFilter),
      ]),

      // POLLS
      Promise.all([
        Poll.countDocuments(dateFilter),
        Promise.resolve(0),
        Poll.countDocuments(todayFilter),
      ]),

      // LIVE NEWS (separate from LIVE)
      Promise.all([
        LiveNews.countDocuments({ status: "online", ...dateFilter }),
        LiveNews.countDocuments({ status: "offline", ...dateFilter }),
        LiveNews.countDocuments(todayFilter),
      ]),

      // REPORT
      Promise.all([
        Report.countDocuments(dateFilter),
        Promise.resolve(0),
        Report.countDocuments(todayFilter),
      ]),

      // CATEGORY
      Promise.all([
        Content.countDocuments(dateFilter),
        Promise.resolve(0),
        Content.countDocuments(todayFilter),
      ]),

      // SUB CATEGORY
      Promise.all([
        SubCategory.countDocuments(dateFilter),
        Promise.resolve(0),
        SubCategory.countDocuments(todayFilter),
      ]),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          activeCount: users[0],
          inactiveCount: users[1],
          todayData: users[2],
        },

        breakingNews: {
          activeCount: breaking[0],
          inactiveCount: breaking[1],
          todayData: breaking[2],
        },

        topStories: {
          activeCount: topStories[0],
          inactiveCount: topStories[1],
          todayData: topStories[2],
        },

        upload: {
          activeCount: uploads[0],
          inactiveCount: uploads[1],
          todayData: uploads[2],
        },

        ads: {
          activeCount: ads[0],
          inactiveCount: ads[1],
          todayData: ads[2],
        },

        flashNews: {
          activeCount: flash[0],
          inactiveCount: flash[1],
          todayData: flash[2],
        },

        livenews: {
          activeCount: livenews[0],
          inactiveCount: livenews[1],
          todayData: livenews[2],
        },

        stories: {
          activeCount: stories[0],
          inactiveCount: stories[1],
          todayData: stories[2],
        },

        videos: {
          activeCount: videos[0],
          inactiveCount: videos[1],
          todayData: videos[2],
        },

        photos: {
          activeCount: photos[0],
          inactiveCount: photos[1],
          todayData: photos[2],
        },

        comments: {
          activeCount: comments[0],
          inactiveCount: comments[1],
          todayData: comments[2],
        },

        live: {
          activeCount: lives[0],
          inactiveCount: lives[1],
          todayData: lives[2],
        },

        polls: {
          activeCount: polls[0],
          inactiveCount: polls[1],
          todayData: polls[2],
        },

        reports: {
          activeCount: reports[0],
          inactiveCount: reports[1],
          todayData: reports[2],
        },

        categories: {
          activeCount: categories[0],
          inactiveCount: categories[1],
          todayData: categories[2],
        },

        subCategories: {
          activeCount: subCategories[0],
          inactiveCount: subCategories[1],
          todayData: subCategories[2],
        },
      },
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};