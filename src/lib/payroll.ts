// UK 2024/25 payroll tax rates and thresholds
// These are statutory UK tax rates and cannot be changed — they are not business config
const ANNUAL_PERSONAL_ALLOWANCE = 12570;   // Standard tax-free allowance
const BASIC_RATE_BAND            = 37700;   // Band for 20% tax rate
const UPPER_EARNINGS_LIMIT       = 50270;   // Annual threshold for different NI rates
const PRIMARY_THRESHOLD          = 12570;   // Employee NI threshold (annual)
const SECONDARY_THRESHOLD        =  9100;   // Employer NI threshold (annual)

const BASIC_RATE         = 0.20;   // 20% income tax rate
const HIGHER_RATE        = 0.40;   // 40% income tax rate
const NI_EMPLOYEE_MAIN   = 0.08;   // 8% employee NI (main band)
const NI_EMPLOYEE_UPPER  = 0.02;   // 2% employee NI (upper band)
const NI_EMPLOYER_RATE   = 0.138;  // 13.8% employer NI rate

export interface PayslipCalc {
  grossPay:         number;
  taxablePay:       number;
  payeTax:          number;
  niEmployee:       number;
  niEmployer:       number;
  totalDeductions:  number;
  netPay:           number;
}

/**
 * Parses UK Tax Codes dynamically:
 * - "1257L" -> £12,570 tax-free allowance
 * - "BR" -> 0 allowance, all taxed at 20%
 * - "0T" -> 0 allowance
 * - "NT" -> No tax
 * - Custom e.g. "1100L" -> £11,000 allowance
 */
export function parseTaxAllowance(taxCode: string): number {
  const code = (taxCode || "1257L").trim().toUpperCase();
  if (code === "BR" || code === "0T" || code === "D0" || code === "D1") return 0;
  if (code === "NT") return 99999999; // No tax
  const match = code.match(/^(\d+)[A-Z]?$/);
  if (match) {
    return parseInt(match[1], 10) * 10;
  }
  return ANNUAL_PERSONAL_ALLOWANCE;
}

export function calculatePayslip(
  grossPay: number,
  period: "weekly" | "monthly",
  taxCode = "1257L",
  employmentType: "paye" | "contractor" = "paye"
): PayslipCalc {
  const r = (n: number) => Math.round(n * 100) / 100;

  // If contractor/self-employed, no PAYE or employee NI deducted at source
  if (employmentType === "contractor") {
    return {
      grossPay:        r(grossPay),
      taxablePay:      0,
      payeTax:         0,
      niEmployee:      0,
      niEmployer:      0,
      totalDeductions: 0,
      netPay:          r(grossPay),
    };
  }

  const divisor = period === "weekly" ? 52 : 12;

  // Dynamic annual allowance based on the employee's actual tax code
  const annualAllowance = parseTaxAllowance(taxCode);
  const personalAllowancePeriod = annualAllowance / divisor;
  const basicRateBandPeriod     = BASIC_RATE_BAND           / divisor;
  const uelPeriod               = UPPER_EARNINGS_LIMIT      / divisor;
  const ptPeriod                = PRIMARY_THRESHOLD         / divisor;
  const stPeriod                = SECONDARY_THRESHOLD       / divisor;

  const codeUpper = (taxCode || "").trim().toUpperCase();
  const taxFreeAmount = personalAllowancePeriod;
  const taxablePay    = Math.max(0, grossPay - taxFreeAmount);

  let payeTax = 0;
  if (codeUpper === "NT") {
    payeTax = 0;
  } else if (codeUpper === "D0") {
    payeTax = grossPay * HIGHER_RATE; // Higher rate (40%) on everything
  } else if (codeUpper === "BR") {
    payeTax = grossPay * BASIC_RATE;  // Basic rate (20%) on everything
  } else if (taxablePay > 0) {
    const basic  = Math.min(taxablePay, basicRateBandPeriod);
    const higher = Math.max(0, taxablePay - basicRateBandPeriod);
    payeTax = basic * BASIC_RATE + higher * HIGHER_RATE;
  }

  // Employee NI
  let niEmployee = 0;
  if (grossPay > ptPeriod) {
    const mainBand  = Math.min(grossPay, uelPeriod) - ptPeriod;
    const upperBand = Math.max(0, grossPay - uelPeriod);
    niEmployee = mainBand * NI_EMPLOYEE_MAIN + upperBand * NI_EMPLOYEE_UPPER;
  }

  // Employer NI
  const niEmployer = Math.max(0, grossPay - stPeriod) * NI_EMPLOYER_RATE;

  const totalDeductions = payeTax + niEmployee;
  const netPay          = grossPay - totalDeductions;

  return {
    grossPay:        r(grossPay),
    taxablePay:      r(taxablePay),
    payeTax:         r(payeTax),
    niEmployee:      r(niEmployee),
    niEmployer:      r(niEmployer),
    totalDeductions: r(totalDeductions),
    netPay:          r(netPay),
  };
}

/** Parse hours from a time slot string like "09:00 – 11:00" */
export function parseShiftHours(timeSlot: string, fallback = 3): number {
  const m = timeSlot.match(/(\d{1,2})(?::(\d{2}))?\s*[–\-]\s*(\d{1,2})(?::(\d{2}))?/);
  if (!m) return fallback;
  const startMins = parseInt(m[1]) * 60 + parseInt(m[2] ?? "0");
  const endMins   = parseInt(m[3]) * 60 + parseInt(m[4] ?? "0");
  const hours = (endMins - startMins) / 60;
  return hours > 0 ? hours : fallback;
}

/** ISO string for the Monday of the week containing a given date */
export function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get next N monday dates as ISO strings starting from today's week */
export function getUpcomingWeeks(n: number): string[] {
  const mondays: string[] = [];
  const base = new Date(getWeekMonday(new Date()));
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    mondays.push(d.toISOString().slice(0, 10));
  }
  return mondays;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Format a week_start ISO date as "Mon 3 Jun – Sun 9 Jun" */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = start.toLocaleDateString("en-GB", opts);
  const endStr   = end.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}
