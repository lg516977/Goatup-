import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import groupsRouter from "./groups";
import blocksRouter from "./blocks";
import reportsRouter from "./reports";
import filesRouter from "./files";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(groupsRouter);
router.use(blocksRouter);
router.use(reportsRouter);
router.use(filesRouter);

export default router;
