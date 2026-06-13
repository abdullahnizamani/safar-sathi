import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./auth";
import { ridesRouter } from "./rides";
import { requestsRouter } from "./requests";
import { statsRouter } from "./stats";
import { reviewsRouter } from "./reviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ridesRouter);
router.use(requestsRouter);
router.use(statsRouter);
router.use(reviewsRouter);

export default router;
