import styles from "./sticky-header-styles.module.css"

// Keep "select-trigger" out of the scope's class attribute: Safari's legacy
// substring selectors would otherwise change the toolbar's position and icons.
export const stickyHeaderSelectClassName = styles.filters