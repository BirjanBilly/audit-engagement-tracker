"use client";

import SwaggerUI from "swagger-ui-react";
import { openApiDocument } from "@/lib/api/openapi";

export function DocsViewer() {
  return <SwaggerUI spec={openApiDocument} deepLinking displayRequestDuration />;
}
