<script>
  // import { page } from '$app/stores';
  import { user } from "$lib/flow/stores";
  import ConnectWallet from "$lib/components/ConnectWallet.svelte";
  import UserAddress from "../UserAddress.svelte";
  import { onMount } from "svelte";
  import { theme } from "$lib/stores.js";
  import { fade, draw } from "svelte/transition";
  import { resolveAddressObject } from "$lib/flow/actions";
  import { getResolvedName } from "$lib/flow/utils";

  let toggleTheme;

  onMount(() => {
    let html = document.querySelector("html");
    html.setAttribute("data-theme", $theme);

    toggleTheme = () => {
      let newTheme = $theme === "light" ? "dark" : "light";
      $theme = newTheme;
      html.setAttribute("data-theme", $theme);
    };
  });

  async function initialize(address) {
    let addressObject = await resolveAddressObject(address);
    return getResolvedName(addressObject);
  }
  $: resolvedName = initialize($user?.addr || "");
</script>

<style>
  nav {
    background-color: var(--card-background-color);
    height: 10vh;
    min-height: 70px;
    box-shadow: var(--card-box-shadow);
    margin-bottom: 20px;
  }
  li {
    margin-right: 1rem;
  }

  h1 {
    font-size: 1.2rem;
  }

  .outline {
    padding: 6px 14px;
  }

  img {
    height: auto;
    max-width: 160px;
  }

  .theme-toggle {
    padding: 0;
    height: 45px;
    width: 45px;
    background-color: var(--primary-focus);
    border-radius: 50%;
    display: inline-block;
    text-align: center;
    justify-content: center;
    display: flex;
    vertical-align: middle;
    align-items: center;
  }

  ul {
    display: flex;
    text-align: center;
    margin: 0 auto;
    align-items: center;
  }

  @media screen and (max-width: 500px) {
    img {
      max-width: 100px;
    }
  }

  @media screen and (max-width: 780px) {
    nav {
      flex-direction: column;
      justify-content: center;
      vertical-align: middle;
      align-items: center;
      margin-bottom: 2rem;
    }

    nav li:last-child {
      margin: 0;
    }

    li h1 a {
      padding: 0;
    }
  }
</style>
