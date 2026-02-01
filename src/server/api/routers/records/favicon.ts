import { z } from 'zod';
import { uploadMediaToR2 } from '@/server/lib/media';
import { publicProcedure } from '../../init';

export const fetchFavicon = publicProcedure
  .input(
    z.object({
      url: z.url(),
      size: z.number().int().min(16).max(256).default(128),
    })
  )
  .mutation(async ({ input }) => {
    const domain = new URL(input.url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${input.size}`;
    const r2Url = await uploadMediaToR2(faviconUrl);
    return { avatarUrl: r2Url };
  });
