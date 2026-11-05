import { Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function placeMenu(trigger, menu) {
  const rect = trigger.getBoundingClientRect();
  const width = menu?.offsetWidth || 240;
  const height = menu?.offsetHeight || 240;
  const gap = 6;
  let top = rect.bottom + gap;
  let left = rect.right - width;
  if (top + height > window.innerHeight - 8) top = rect.top - gap - height;
  if (left < 8) left = 8;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  if (top < 8) top = 8;
  return { top, left };
}

export function ActionMenu({ label, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    function onBus(event) {
      if (event.detail !== menuId) setOpen(false);
    }
    window.addEventListener("graveloc-menu", onBus);
    return () => window.removeEventListener("graveloc-menu", onBus);
  }, [menuId]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    function place() {
      if (!triggerRef.current) return;
      setPos(placeMenu(triggerRef.current, menuRef.current));
    }
    place();
    const first = menuRef.current?.querySelector("a, button");
    first?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((value) => {
      const next = !value;
      if (next && triggerRef.current) {
        setPos(placeMenu(triggerRef.current, null));
        window.dispatchEvent(new CustomEvent("graveloc-menu", { detail: menuId }));
      }
      return next;
    });
  }

  function onMenuKey(event) {
    if (!menuRef.current) return;
    const items = [...menuRef.current.querySelectorAll("a, button")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
    }
    if (event.key === "ArrowDown") items[(index + 1) % items.length]?.focus({ preventScroll: true });
    if (event.key === "ArrowUp") items[(index - 1 + items.length) % items.length]?.focus({ preventScroll: true });
    if (event.key === "Home") items[0]?.focus({ preventScroll: true });
    if (event.key === "End") items[items.length - 1]?.focus({ preventScroll: true });
  }

  const items = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child, {
      role: "menuitem",
      onClick: (event) => {
        child.props.onClick?.(event);
        setOpen(false);
      },
    });
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className="action-menu-panel action-menu-portal"
              style={{ top: pos.top, left: pos.left }}
              onKeyDown={onMenuKey}
            >
              {items}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
