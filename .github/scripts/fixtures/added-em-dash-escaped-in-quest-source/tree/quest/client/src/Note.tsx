export function Note() {
  return [
    <p key="a">Nothing here &mdash; yet</p>,
    <p key="b">Nothing here &#8212; yet</p>,
    <p key="c">Nothing here &#x2014; yet</p>,
    <p key="d">{"Nothing here \u2014 yet"}</p>,
    <p key="e">{"Nothing here \u{2014} yet"}</p>,
  ];
}
