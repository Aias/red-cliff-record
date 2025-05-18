import type { RecordGet } from '@/server/api/routers/types';
import { MetadataList } from '@/components';

export const MetadataSection = ({ record }: { record: RecordGet }) => {
    return (
        <div className="flex flex-col gap-3">
            <h2>Record Metadata</h2>
            <MetadataList
                metadata={{
                    ID: record.id,
                    Slug: record.slug,
                    Created: record.recordCreatedAt,
                    Updated: record.recordUpdatedAt,
                    'Content Created': record.contentCreatedAt,
                    'Content Updated': record.contentUpdatedAt,
                }}
            />
        </div>
    );
};
