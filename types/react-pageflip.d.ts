// react-pageflip (npm: react-pageflip, currently pinned to ^2.0.3 in
// package.json) ships no bundled TypeScript types, and there is no
// separate @types/react-pageflip package on npm either (checked -- 404).
// This is a hand-written declaration covering only the surface this
// project actually uses, sourced from the library's own README
// (https://github.com/Nodlik/react-pageflip), not from a .d.ts the
// package provides -- if a future react-pageflip upgrade changes that
// surface, this file needs a matching manual update, same as the
// enforceChapterPageStarts port in the page-image generation pipeline
// needs updating if lib/books.ts's rendering logic ever changes.
declare module "react-pageflip" {
  import { Component, CSSProperties, ReactNode } from "react";

  export type FlipCorner = "top" | "bottom";
  export type PageOrientation = "portrait" | "landscape";

  export interface PageFlip {
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): PageOrientation;
    turnToPage(pageNum: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(pageNum: number, corner?: FlipCorner): void;
    destroy(): void;
  }

  export interface HTMLFlipBookEvent<T> {
    data: T;
  }

  export interface HTMLFlipBookProps {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    renderOnlyPageLengthChange?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onFlip?: (e: HTMLFlipBookEvent<number>) => void;
    onChangeOrientation?: (e: HTMLFlipBookEvent<PageOrientation>) => void;
    onChangeState?: (e: HTMLFlipBookEvent<string>) => void;
    onInit?: (e: HTMLFlipBookEvent<{ page: number; mode: string }>) => void;
    onUpdate?: (e: HTMLFlipBookEvent<{ page: number; mode: string }>) => void;
  }

  export default class HTMLFlipBook extends Component<HTMLFlipBookProps> {
    pageFlip(): PageFlip;
  }
}
