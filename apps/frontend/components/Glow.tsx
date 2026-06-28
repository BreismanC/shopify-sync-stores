const Glow = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="164"
      height="240"
      viewBox="0 0 164 240"
      fill="none"
      className="size-full scale-150 translate-x-1/3"
    >
      <circle cx="44" cy="120" r="120" fill="url(#paint0_radial_glow)" />
      <defs>
        <radialGradient
          id="paint0_radial_glow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(44 120) rotate(90) scale(120)"
        >
          <stop stopColor="#EA4E1A" stopOpacity="0.6" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
};

export default Glow;