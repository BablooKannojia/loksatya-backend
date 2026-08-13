import { AdsS } from "../Models/AdsSchema.js";
import { errHandler, responseHandler } from "../helper/response.js";

const Ads = async (req, res) => {
  try {
    const { id } = req.query;

    const {
      StartAt,
      EndAt,
      noOfImpression = 0,
    } = req.body;

    const startDate = new Date(StartAt);
    const endDate = new Date(EndAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        message: "Invalid StartAt or EndAt",
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        message: "EndAt must be greater than StartAt",
      });
    }

    const ad = await AdsS.create({
      ...req.body,
      userId: id,
      StartAt: startDate,
      EndAt: endDate,
      noOfImpression,
    });

    return responseHandler(res, ad);

  } catch (err) {
    console.error("Ads create error:", err);
    return errHandler(res, 5, 403);
  }
};

const GetAds = async (req, res) => {
  try {
    const {
      side,
      active,
      device,
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(Number(page), 1);
    const pageSize = Math.min(Math.max(Number(limit), 1), 100);
    const skip = (currentPage - 1) * pageSize;

    const filter = {};

    if (side) {
      filter.side = side;
    }

    if (device) {
      filter.$or = [
        { device },
        { device: "both" },
      ];
    }

    if (active === "true") {
      const now = new Date();

      filter.active = true;
      filter.StartAt = { $lte: now };
      filter.EndAt = { $gte: now };
    }

    const [data, total] = await Promise.all([
      AdsS
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      AdsS.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      data,
      total,
      page: currentPage,
      limit: pageSize,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    });

  } catch (err) {
    console.error("GetAds Error:", err);

    return res.status(500).json({
      message: "Failed to fetch advertisements",
      error: err.message,
    });
  }
};

const IncrementNoOfImpression = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        message: "Ad ID is required",
      });
    }

    const ad = await AdsS.findByIdAndUpdate(
      id,
      {
        $inc: {
          noOfImpression: 1,
        },
      },
      {
        new: true,
        lean: true,
      }
    );

    if (!ad) {
      return res.status(404).json({
        message: "Ad not found",
      });
    }

    return res.status(200).json({
      message: "Impression incremented successfully",
      data: ad,
    });

  } catch (error) {
    console.error("Increment impression error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const ClickAds = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Ad ID is required" });
  }

  try {
    const updatedAd = await incrementNoAdsById(id);
    return res.json(updatedAd);
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
async function incrementNoAdsById(adId) {
  try {
    const updatedAd = await AdsS.findByIdAndUpdate(
      adId,
      { $inc: { noAds: 1 } },
      { new: true }
    );

    if (!updatedAd) {
      throw new Error("Ad not found");
    }

    return updatedAd;
  } catch (error) {
    throw new Error(`Error incrementing noAds: ${error.message}`);
  }
}

const approvedAds = (req, res) => {
  let { id } = req.params;
  let body = req.body;

  AdsS.findByIdAndUpdate({ _id: id }, body, { new: true })
    .then((data) => {
      responseHandler(res, {
        data,
      });
    })
    .catch((err) => {
      errHandler(res, 5, 409);
    });
};

const DeleteAds = (req, res) => {
  const { id } = req.params;
  console.log(id);
  AdsS.findByIdAndDelete({ _id: id }).then((data) => {
    responseHandler(res, {
      message: "Advertisement Deleted Successfully",
      data: data,
      status: 200,
    });
  });
};

const DashboardAds = async (req, res) => {
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

    // Find all ads and apply date filtering criteria if provided
    const allAds = await AdsS.find(dateFilter);

    // Count the number of ads created today
    const today = new Date();
    const todayData = await AdsS.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      },
    });

    // Filter active ads
    const activeAds = allAds.filter((ad) => ad.active);

    // Filter inactive ads
    const inactiveAds = allAds.filter((ad) => !ad.active);

    // Count of active ads
    const activeAdsCount = activeAds.length;

    // Count of inactive ads
    const inactiveAdsCount = inactiveAds.length;

    res.json({
      activeCount: activeAdsCount,
      inactiveCount: inactiveAdsCount,
      todayData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
  Ads,
  GetAds,
  ClickAds,
  DeleteAds,
  IncrementNoOfImpression,
  approvedAds,
  DashboardAds,
};
