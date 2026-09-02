import { Comment } from "../Models/CommentSchema.js";
import { errHandler, responseHandler } from "../helper/response.js";

const OnComment = async (req, res) => {
  try {
    console.log(req.body);

    const data = await Comment.create(req.body);

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
const DeleteComment = (req, res) => {
  const { id } = req.query;
  // console.log(id);
  Comment.findByIdAndDelete({ _id: id }).then((data) => {
    responseHandler(res, data);
  });
};
const GetComment = async (req, res) => {
  try {
    let obj = {};

    const {
      id,
      commentID,
      email,
      name,
      comment
    } = req.query;

    if (id) {
      obj.postId = id;
    }

    if (commentID) {
      obj._id = commentID;
    }

    if (email) {
      obj.email = new RegExp(email, "i");
    }

    if (name) {
      obj.name = new RegExp(name, "i");
    }

    if (comment) {
      obj.message = new RegExp(comment, "i");
    }

    const data = await Comment.find(obj).sort({ createdAt: -1 });

    return responseHandler(res, data);

  } catch (err) {
    console.error("GetComment Error:", err);
    return errHandler(res, 5, err);
  }
};

const DashBoardComment = async (req,res)=>{
  try {
    const { date } = req.query;
    let dateFilter = {};

    // If date query parameter is provided, attempt to construct date filtering criteria
    if (date) {
      const [startDate, endDate] = date.split(',');
      const isValidDate = (dateString) => !isNaN(new Date(dateString).getTime());

      if (isValidDate(startDate) && isValidDate(endDate)) {
        // Construct date filtering criteria only if both startDate and endDate are valid dates
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
    }

    // Find all comments and apply date filtering criteria if provided
    const allComments = await Comment.find(dateFilter);

    // Count the number of comments created today
    const todayData = await Comment.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    // Count of active comments
    const activeCount = allComments.length;

    // Inactive count is always 0
    const inactiveCount = 0;

    res.json({ activeCount, inactiveCount, todayData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export {OnComment,GetComment,DeleteComment,DashBoardComment}