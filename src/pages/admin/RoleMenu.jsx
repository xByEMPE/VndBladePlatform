import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRoleChip, getRoleFocus } from "@/lib/roleLabel";

const TRIGGER_BASE =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Chip de rol con menú desplegable propio (tema oscuro, colores del design system).
 * Patrón ARIA "select-only combobox": el botón es role=combobox y las opciones role=option.
 * El menú se dibuja en un portal con posición fija para que no lo recorte el scroll de la tabla.
 *
 * @param {{
 *   value: string,
 *   options: Array<{ value: string, label: string }>,
 *   currentLabel: string,
 *   onChange: (value: string) => void,
 *   ariaLabel: string,
 *   id?: string,
 *   className?: string,
 * }} props
 */
const RoleMenu = ({ value, options, currentLabel, onChange, ariaLabel, id, className }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    const onViewport = () => close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, close]);

  const select = (optionValue) => {
    close(true);
    if (optionValue !== value) onChange(optionValue);
  };

  const onTriggerKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(options[active].value);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={cn(TRIGGER_BASE, getRoleChip(value), getRoleFocus(value), className)}
      >
        {currentLabel}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width }}
            className="z-50 min-w-40 rounded-xl border border-line-subtle bg-surface-panel p-1.5 shadow-xl"
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    i > 0 && "mt-0.5",
                    // cada opción lleva el color de su propio rol; la activa/seleccionada se enciende
                    active === i || selected ? getRoleChip(o.value) : "border-transparent text-ink",
                  )}
                >
                  {o.label}
                  {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
};

export default RoleMenu;
