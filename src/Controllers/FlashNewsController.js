import { flashnews } from "../Models/FlashSchema.js";
import { errHandler, responseHandler } from "../helper/response.js";

const uploadNews = (req, res) => {
  const body = req.body;
  const { id } = req.query;

  const link = body.link || "";
  const slug = (link.split("/details/")[1] || "").split("?")[0];

  flashnews
    .create({
      _id: `LOKFL${id}+${Date.now()}`,
      ...body,
      slug,
      userId: id,
    })
    .then((data) => {
      responseHandler(res, data);
    })
    .catch((err) => {
      console.log(err);
      errHandler(res, 5, 403);
    });
};

const updateNews = (req, res) => {
  const { id } = req.params;
  const { link, slugName } = req.body;

  const slug = (link.split("/details/")[1] || "").split("?")[0];

  flashnews
    .findByIdAndUpdate(
      id,
      {
        $set: {
          link,
          slugName,
          slug,
        },
      },
      { new: true }
    )
    .then((data) => {
      if (data) {
        responseHandler(res, data);
      } else {
        errHandler(res, "News item not found", 404);
      }
    })
    .catch((err) => {
      console.log(err);
      errHandler(res, "Internal Server Error", 500);
    });
};

const updateNewsStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "active" && status !== "inactive") {
    return errHandler(res, "Invalid status provided", 400);
  }

  flashnews
    .findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, useFindAndModify: false }
    )
    .then((data) => {
      if (data) {
        responseHandler(res, data);
      } else {
        errHandler(res, "News item not found", 404);
      }
    })
    .catch((err) => {
      console.log(err);
      errHandler(res, "Internal Server Error", 500);
    });
};

const getAllNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await flashnews.countDocuments();

    const data = await flashnews
      .find({})
      .select("_id link slug slugName status createdAt updatedAt userId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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

const DashBoardFlashNews = async (req, res) => {
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

    // Find all flash news and apply date filtering criteria if provided
    // const allFlashNews = await flashnews.find(dateFilter);
    const allFlashNews = await flashnews.find(dateFilter).sort({ createdAt: -1 });

    // Count the number of flash news created today
    const today = new Date();
    const todayData = await flashnews.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    // Filter active flash news
    const activeFlashNews = allFlashNews.filter(
      (news) => news.status === "active"
    );

    // Filter inactive flash news
    const inactiveFlashNews = allFlashNews.filter(
      (news) => news.status === "inactive"
    );

    // Count of active flash news
    const activeFlashNewsCount = activeFlashNews.length;

    // Count of inactive flash news
    const inactiveFlashNewsCount = inactiveFlashNews.length;

    res.json({
      activeCount: activeFlashNewsCount,
      inactiveCount: inactiveFlashNewsCount,
      todayData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteFlashNews = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await flashnews.findByIdAndDelete(id);

    if (!data) {
      return errHandler(res, "News item not found", 404);
    }

    return responseHandler(res, {
      message: "Flash news deleted successfully",
    });
  } catch (err) {
    console.log(err);
    return errHandler(res, "Internal Server Error", 500);
  }
};

export {
  uploadNews,
  getAllNews,
  updateNews,
  deleteFlashNews,
  updateNewsStatus,
  DashBoardFlashNews,
};
