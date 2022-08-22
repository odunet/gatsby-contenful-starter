import React from 'react'

const SSR = ({ serverData }) => {
  return (
    <div>
      <h1>SSR</h1>
      <img alt="Happy dog" src={serverData.message} />
    </div>

  )
}

export default SSR

export async function getServerData() {
  try {
    const res = await fetch(`https://dog.ceo/api/breeds/image/random`)
    if (!res.ok) {
      throw new Error(`Response failed`)
    }
    return {
      props: await res.json(),
    }
  } catch (error) {
    return {
      status: 500,
      headers: {},
      props: {},
    }
  }
}