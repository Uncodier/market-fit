import styles from "./sticky-header-styles.module.css"

export const stickyHeaderBorderClassName = "border-b dark:border-white/5 border-black/5"

// Keep "select-trigger" out of the scope's class attribute: Safari's legacy
// substring selectors would otherwise change the toolbar's position and icons.
export const stickyHeaderSelectClassName = styles.filters