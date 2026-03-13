import { z } from 'zod';

// Error response schema - used by isError() utility
export const errorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Docs: https://productpages.redhat.com/api/v7/whoami/
 */

export const whoamiSchema = z.object({
  username: z.string(),
});

export type WhoamiResponse = z.infer<typeof whoamiSchema>;

/**
 * Docs: https://productpages.redhat.com/api/v7/releases/rhel-8.2.0/
 */

export const releasesSchema = z.looseObject({
  product_name: z.string(),
  name: z.string(),
  shortname: z.string(),
  all_ga_tasks: z.array(
    z.object({
      main: z.boolean(),
      name: z.string(),
      slug: z.string(),
      draft: z.boolean(),
      invalid: z.boolean(),
      date_start: z.string(),
      date_finish: z.string(),
    })
  ),
});

export type ReleasesResponse = z.infer<typeof releasesSchema>;

/**
 * Docs: https://productpages.redhat.com/api/v7/releases/rhel-8.2.0/schedules/
 */

export type ScheduleTaskField =
  | 'id'
  | 'name'
  | 'path'
  | 'date_start'
  | 'date_finish'
  | 'release_shortname';

export type ScheduleTaskOrderingField =
  | 'date_start'
  | 'date_finish'
  | '-date_start'
  | '-date_finish';

export type ScheduleTasksQueryOptions = {
  fields?: ScheduleTaskField[];
  search?: string;
  ordering?: ScheduleTaskOrderingField;
  name__regex?: string;
};

export const releasesScheduleTasksSchema = z.array(
  z.looseObject({
    id: z.number(),
    name: z.string(),
    path: z.array(z.string()),
    date_start: z.string(),
    date_finish: z.string(),
    release_shortname: z.string(),
  })
);

export type ReleasesScheduleTasksResponse = z.infer<
  typeof releasesScheduleTasksSchema
>;
