import ShiplightReporter from 'shiplightai/reporter';
import type { TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { redactReportText } from './report-redaction';

function sanitizeError(error?: TestError): void {
  if (!error) return;
  for (const key of ['message', 'stack', 'value', 'snippet'] as const) {
    if (error[key]) error[key] = redactReportText(error[key]!);
  }
}

function sanitizeStep(step: TestStep): void {
  step.title = redactReportText(step.title);
  sanitizeError(step.error);
  for (const child of step.steps) sanitizeStep(child);
}

/** Vendor report format remains unchanged; raw native steps never reach it. */
export default class SafeShiplightReporter extends ShiplightReporter {
  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    sanitizeStep(step);
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    sanitizeStep(step);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    for (const step of result.steps) sanitizeStep(step);
    for (const error of result.errors) sanitizeError(error);
    sanitizeError(result.error);
    result.stdout = result.stdout.map(value => redactReportText(value.toString()));
    result.stderr = result.stderr.map(value => redactReportText(value.toString()));
    super.onTestEnd(test, result);
  }
}