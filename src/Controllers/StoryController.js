import { Story } from "../Models/StoriesSchema.js";
import { validationResult } from "express-validator";
import { responseHandler } from "../helper/response.js";

const createStory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, image, imageTexts, periority, albumPeriority } = req.body;
    let img = image;
    if (!Array.isArray(image)) {
      img = [image];
    }
    const newStory = new Story({
      title: title,
      periority: periority,
      images: img.map((i, index) => ({
        img: i,
        text: imageTexts[index],
        albumPeriority: albumPeriority[index],
      })),
    });
    const savedStory = await newStory.save();
    res.json(savedStory);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const getStoryById = async (req, res) => {
  try {
    const article = await Story.findById(req.params.id);
    if (!article) {
      return res.status(404).send("Article not found");
    }
    res.json(article);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
const DeleteStory = (req, res) => {
  const { id } = req.query;
  Story.findByIdAndDelete({ _id: id }).then((data) => {
    responseHandler(res, data);
  });
};

const getAllStories = async (req, res) => {
  try {
    let {
      id,
      title,
      status,
      page,
      limit,
      paginate,
    } = req.query;

    const filter = {};

    if (id) {
      filter._id = id;
    }

    if (title) {
      filter.title = new RegExp(title, "i");
    }

    if (status !== undefined) {
      filter.status = status === "true";
    }

    // Total Count
    const total = await Story.countDocuments(filter);

    // Base Query
    let query = Story.find(filter).sort({ _id: -1 });

    // Pagination ON
    if (paginate === "true") {
      page = Number(page) || 1;
      limit = Number(limit) || 10;

      const skip = (page - 1) * limit;

      const stories = await query.skip(skip).limit(limit);

      return res.json({
        success: true,
        data: stories,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      });
    }

    // Only limit (Example: Home page)
    if (limit) {
      const stories = await query.limit(Number(limit));

      return res.json({
        success: true,
        total: stories.length,
        data: stories,
      });
    }

    // Return All Data
    const stories = await query;

    return res.json({
      success: true,
      total: stories.length,
      data: stories,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const approvedStories = (req, res) => {
  let { id } = req.params;
  let body = req.body;

  Story.findByIdAndUpdate({ _id: id }, body, { new: true })
    .then((data) => {
      responseHandler(res, {
        data,
      });
    })
    .catch((err) => {
      errHandler(res, 5, 409);
    });
};
const DashBoardStories = async (req, res) => {
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

    // Find all stories and apply date filtering criteria if provided
    const allStories = await Story.find(dateFilter);

    // Count the number of stories created today
    const today = new Date();
    const todayData = await Story.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    // Filter active stories
    const activeStories = allStories.filter((story) => story.status === true);

    // Filter inactive stories
    const inactiveStories = allStories.filter(
      (story) => story.status === false
    );

    // Count of active stories
    const activeStoriesCount = activeStories.length;

    // Count of inactive stories
    const inactiveStoriesCount = inactiveStories.length;

    res.json({
      activeCount: activeStoriesCount,
      inactiveCount: inactiveStoriesCount,
      todayData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export {
  createStory,
  getStoryById,
  getAllStories,
  DeleteStory,
  approvedStories,
  DashBoardStories,
};
