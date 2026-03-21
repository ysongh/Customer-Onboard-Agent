import type { SchemaField } from "./supabase.ts";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(
  fieldDef: SchemaField,
  value: unknown,
): ValidationResult {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: false, error: `${fieldDef.field_label} is required.` };
  }

  const raw = String(value).trim();

  switch (fieldDef.field_type) {
    case "email": {
      const email = raw.toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        return { valid: false, error: "Please provide a valid email address." };
      }
      return { valid: true, sanitized: email };
    }

    case "phone": {
      const digits = raw.replace(/[\s\-\(\)\+\.]/g, "");
      if (!/^\d{7,15}$/.test(digits)) {
        return {
          valid: false,
          error: "Phone number must contain 7–15 digits.",
        };
      }
      return { valid: true, sanitized: raw };
    }

    case "url": {
      let urlStr = raw;
      if (!/^https?:\/\//i.test(urlStr)) {
        urlStr = "https://" + urlStr;
      }
      try {
        new URL(urlStr);
      } catch {
        return { valid: false, error: "Please provide a valid URL." };
      }
      return { valid: true, sanitized: urlStr };
    }

    case "number": {
      if (isNaN(Number(raw))) {
        return { valid: false, error: "Please provide a valid number." };
      }
      return { valid: true, sanitized: raw };
    }

    case "select": {
      const options = (fieldDef.validation_regex || "")
        .split("|")
        .map((o) => o.trim());
      const match = options.find(
        (o) => o.toLowerCase() === raw.toLowerCase(),
      );
      if (!match) {
        return {
          valid: false,
          error: `Please choose one of: ${options.join(", ")}`,
        };
      }
      return { valid: true, sanitized: match };
    }

    case "text":
    case "textarea": {
      if (raw.length > 500) {
        return {
          valid: false,
          error: "Value is too long (max 500 characters).",
        };
      }
      if (fieldDef.validation_regex) {
        const regex = new RegExp(fieldDef.validation_regex);
        if (!regex.test(raw)) {
          return {
            valid: false,
            error: `${fieldDef.field_label} format is invalid.`,
          };
        }
      }
      return { valid: true, sanitized: raw };
    }

    default:
      return { valid: true, sanitized: raw };
  }
}
