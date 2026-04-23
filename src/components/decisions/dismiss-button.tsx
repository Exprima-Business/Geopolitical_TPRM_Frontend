"use client";

/**
 * Trigger button for the DismissDialog.
 *
 * Owns the open/close state so a parent only has to render this button next
 * to a decision card and pass the decision id + event context + an
 * onDismissed callback to refresh its list.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  DismissDialog,
  type DismissDecisionContext,
} from "./dismiss-dialog";

export interface DismissButtonProps {
  decisionId: string;
  decisionContext: DismissDecisionContext;
  onDismissed: () => void;
  /** Optional override for the visible label. Defaults to "Dismiss". */
  label?: string;
  /** Hide the label for icon-only usage in dense rows. */
  iconOnly?: boolean;
  className?: string;
  disabled?: boolean;
}

export function DismissButton({
  decisionId,
  decisionContext,
  onDismissed,
  label = "Dismiss",
  iconOnly = false,
  className,
  disabled,
}: DismissButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
        disabled={disabled}
        aria-label={iconOnly ? label : undefined}
      >
        <X className="h-3.5 w-3.5" />
        {!iconOnly && <span>{label}</span>}
      </Button>
      <DismissDialog
        decisionId={decisionId}
        decisionContext={decisionContext}
        open={open}
        onOpenChange={setOpen}
        onDismissed={() => {
          onDismissed();
          setOpen(false);
        }}
      />
    </>
  );
}

export default DismissButton;
