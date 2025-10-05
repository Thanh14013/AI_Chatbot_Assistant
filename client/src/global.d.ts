// Declarations for importing CSS, CSS modules and static assets in the client
// This file prevents TypeScript errors like:
// "Cannot find module or type declarations for side-effect import of './index.css'. ts(2882)"

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.css";

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.scss";

declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";

declare module "*.svg" {
  const content: string;
  export default content;
}

export {};
