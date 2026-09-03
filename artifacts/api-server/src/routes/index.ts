import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import pushRouter from "./push";
import emailRouter from "./email";
import aiRouter from "./ai";
import onboardingRouter from "./onboarding";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(pushRouter);
router.use(emailRouter);
router.use(aiRouter);
router.use(onboardingRouter);
router.use(billingRouter);

export default router;
