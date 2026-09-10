import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import pushRouter from "./push";
import emailRouter from "./email";
import aiRouter from "./ai";
import onboardingRouter from "./onboarding";
import billingRouter from "./billing";
import domainsRouter from "./domains";
import examsRouter from "./exams";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(pushRouter);
router.use(emailRouter);
router.use(aiRouter);
router.use(onboardingRouter);
router.use(billingRouter);
router.use(domainsRouter);
router.use(examsRouter);
router.use(webhooksRouter);

export default router;
