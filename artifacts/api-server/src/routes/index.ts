import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import playersRouter from "./players";
import laddersRouter from "./ladders";
import seasonsRouter from "./seasons";
import teamsRouter from "./teams";
import invitationsRouter from "./invitations";
import ladderRouter from "./ladder";
import challengesRouter from "./challenges";
import availabilityRouter from "./availability";
import matchesRouter from "./matches";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(playersRouter);
router.use(laddersRouter);
router.use(seasonsRouter);
router.use(teamsRouter);
router.use(invitationsRouter);
router.use(ladderRouter);
router.use(challengesRouter);
router.use(availabilityRouter);
router.use(matchesRouter);
router.use(notificationsRouter);
router.use(adminRouter);
router.use(cronRouter);

export default router;
