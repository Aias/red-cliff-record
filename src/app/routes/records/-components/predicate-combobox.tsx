import type { PredicateSelect } from '@/db/schema';
import type { RelationshipAction } from './record-lookup';
import {
        Command,
        CommandGroup,
        CommandInput,
        CommandItem,
        CommandList,
        CommandSeparator,
} from '@/components/ui/command';

interface PredicateComboboxProps {
        predicates: PredicateSelect[];
        onPredicateSelect(id: number): void;
        actions?: RelationshipAction[];
        includeNonCanonical?: boolean;
}

export function PredicateCombobox({
        predicates,
        onPredicateSelect,
        actions = [],
        includeNonCanonical = false,
}: PredicateComboboxProps) {
        return (
                <Command className="w-full">
                        <CommandInput autoFocus placeholder="Select relation type…" />
                        <CommandList>
                                <CommandGroup heading="Predicates">
                                        {predicates
                                                .filter((p) => includeNonCanonical || p.canonical)
                                                .map((p) => (
                                                        <CommandItem
                                                                className="flex gap-2 capitalize"
                                                                key={p.id}
                                                                onSelect={() => onPredicateSelect(p.id)}
                                                        >
                                                                <span className="font-medium">{p.name}</span>
                                                                <span className="text-c-hint">{p.type}</span>
                                                        </CommandItem>
                                                ))}
                                </CommandGroup>

                                {actions.length > 0 && (
                                        <>
                                                <CommandSeparator />
                                                <CommandGroup heading="Actions">
                                                        {actions.map((a) => (
                                                                <CommandItem key={a.key} onSelect={a.onSelect}>
                                                                        {a.label}
                                                                </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                        </>
                                )}
                        </CommandList>
                </Command>
        );
}
