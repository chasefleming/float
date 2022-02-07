import { browser } from '$app/env';
import { get } from 'svelte/store';

import * as fcl from "@samatech/onflow-fcl-esm";
import "./config";
import { user, txId, transactionStatus, transactionInProgress } from './stores.js';

if (browser) {
  // set Svelte $user store to currentUser, 
  // so other components can access it
  fcl.currentUser.subscribe(user.set, [])
}

// Lifecycle FCL Auth functions
export const unauthenticate = () => fcl.unauthenticate();
export const authenticate = () => fcl.authenticate();

export const createFloat = async (draftFloat) => {

  /**
   * WE NEED TO VALIDATE THE DRAFT FLOAT
   * AND PARSE THE FIELDS AND GET THEM 
   * READY FOR THE TRANSACTION (i.e. turn them into the right arguments)
   */
  
  let floatObject = {
    claimable: draftFloat.claimable,
    name: draftFloat.name,
    description: draftFloat.description,
    image: draftFloat.ipfsHash,
    url: draftFloat.url,
    transferrable: draftFloat.transferrable,
    timelock: draftFloat.timelock,
    dateStart: +new Date(draftFloat.startTime) / 1000,
    timePeriod: (+new Date(draftFloat.endTime) / 1000) - (+new Date(draftFloat.startTime) / 1000),
    secret: draftFloat.claimCodeEnabled,
    secretPhrase: draftFloat.claimCode,
    limited: draftFloat.quantity ? true : false,
    capacity: draftFloat.quantity ? draftFloat.quantity : 0,
  };

  let transactionId = false;
  initTransactionState()

  try {
    transactionId = await fcl.mutate({
      cadence: `
      import FLOAT from 0xFLOAT
      import NonFungibleToken from 0xNFT
      import MetadataViews from 0xMDV

      transaction(claimable: Bool, name: String, description: String, image: String, url: String, transferrable: Bool, timelock: Bool, dateStart: UFix64, timePeriod: UFix64, secret: Bool, secretPhrase: String, limited: Bool, capacity: UInt64) {

        let FLOATEvents: &FLOAT.FLOATEvents
      
        prepare(acct: AuthAccount) {
          // set up the FLOAT Collection where users will store their FLOATs
          if acct.borrow<&FLOAT.Collection>(from: FLOAT.FLOATCollectionStoragePath) == nil {
              acct.save(<- FLOAT.createEmptyCollection(), to: FLOAT.FLOATCollectionStoragePath)
              acct.link<&FLOAT.Collection{NonFungibleToken.Receiver, NonFungibleToken.CollectionPublic, MetadataViews.ResolverCollection}>
                      (FLOAT.FLOATCollectionPublicPath, target: FLOAT.FLOATCollectionStoragePath)
          }
      
          if acct.borrow<&FLOAT.FLOATEvents>(from: FLOAT.FLOATEventsStoragePath) == nil {
            // set up the FLOAT Events where users will store all their created events
            acct.save(<- FLOAT.createEmptyFLOATEventCollection(), to: FLOAT.FLOATEventsStoragePath)
            acct.link<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic, MetadataViews.ResolverCollection}>(FLOAT.FLOATEventsPublicPath, target: FLOAT.FLOATEventsStoragePath)
          }
      
          self.FLOATEvents = acct.borrow<&FLOAT.FLOATEvents>(from: FLOAT.FLOATEventsStoragePath)
                              ?? panic("Could not borrow the FLOATEvents from the signer.")
        }
      
        execute {
          var Timelock: FLOAT.Timelock? = nil
          var Secret: FLOAT.Secret? = nil
          var Limited: FLOAT.Limited? = nil
          
          if timelock {
            Timelock = FLOAT.Timelock(_dateStart: dateStart, _timePeriod: timePeriod)
          }
          
          if secret {
            Secret = FLOAT.Secret(_secretPhrase: secretPhrase)
          }
      
          if limited  {
            Limited = FLOAT.Limited(_capacity: capacity)
          }
          
          self.FLOATEvents.createEvent(claimable: claimable, timelock: Timelock, secret: Secret, limited: Limited, name: name, description: description, image: image, url: url, transferrable: transferrable, {})
          log("Started a new event.")
        }
      }  
      `,
      args: (arg, t) => [
        arg(floatObject.claimable, t.Bool),
        arg(floatObject.name, t.String),
        arg(floatObject.description, t.String),
        arg(floatObject.image, t.String),
        arg(floatObject.url, t.String),
        arg(floatObject.transferrable, t.Bool),
        arg(floatObject.timelock, t.Bool),
        arg(floatObject.dateStart.toFixed(1), t.UFix64),
        arg(floatObject.timePeriod.toFixed(1), t.UFix64),
        arg(floatObject.secret, t.Bool),
        arg(floatObject.secretPhrase, t.String),
        arg(floatObject.limited, t.Bool),
        arg(floatObject.capacity, t.UInt64),
      ],
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 999
    })

    txId.set(transactionId);

    fcl.tx(transactionId).subscribe(res => {
      transactionStatus.set(res.status)
      if(res.status === 4) {
        setTimeout(() => transactionInProgress.set(false),2000)
      }
    })

  } catch (e) {
    transactionStatus.set(99)
    console.log(e)
  }
}

export const claimFLOAT = async (host, id, secret) => {

  let transactionId = false;
  initTransactionState()

  try {
    transactionId = await fcl.mutate({
      cadence: `
      import FLOAT from 0xFLOAT
      import NonFungibleToken from 0xNFT
      import MetadataViews from 0xMDV
      
      transaction(id: UInt64, host: Address, secret: String) {
 
        let FLOATEvents: &FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic}
        let Collection: &FLOAT.Collection
      
        prepare(acct: AuthAccount) {
          // set up the FLOAT Collection where users will store their FLOATs
          if acct.borrow<&FLOAT.Collection>(from: FLOAT.FLOATCollectionStoragePath) == nil {
              acct.save(<- FLOAT.createEmptyCollection(), to: FLOAT.FLOATCollectionStoragePath)
              acct.link<&FLOAT.Collection{NonFungibleToken.Receiver, NonFungibleToken.CollectionPublic, MetadataViews.ResolverCollection}>
                      (FLOAT.FLOATCollectionPublicPath, target: FLOAT.FLOATCollectionStoragePath)
          }
          
          self.FLOATEvents = getAccount(host).getCapability(FLOAT.FLOATEventsPublicPath)
                              .borrow<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic}>()
                              ?? panic("Could not borrow the public FLOATEvents from the host.")
          self.Collection = acct.borrow<&FLOAT.Collection>(from: FLOAT.FLOATCollectionStoragePath)
                              ?? panic("Could not get the Collection from the signer.")
        }
      
        execute {
          self.FLOATEvents.claim(id: id, recipient: self.Collection, secret: secret)
          log("Claimed the FLOAT.")
        }
      }
      `,
      args: (arg, t) => [
        arg(id, t.UInt64),
        arg(host, t.Address),
        arg(secret, t.String),
      ],
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 999
    })

    txId.set(transactionId);

    fcl.tx(transactionId).subscribe(res => {
      transactionStatus.set(res.status)
      if(res.status === 4) {
        setTimeout(() => transactionInProgress.set(false),2000)
      }
    })

  } catch (e) {
    transactionStatus.set(99)
    console.log(e)
  }
}

export const getFLOATEvent = async (addr, id) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT
      import MetadataViews from 0xMDV

      pub fun main(account: Address, id: UInt64): MetadataViews.FLOATEventMetadataView? {
        let floatEventCollection = getAccount(account).getCapability(FLOAT.FLOATEventsPublicPath)
                                    .borrow<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic, MetadataViews.ResolverCollection}>()
                                    ?? panic("Could not borrow the FLOAT Events Collection from the account.")
        let floatEvent =  floatEventCollection.borrowViewResolver(id: id)
      
        if let metadata = floatEvent.resolveView(Type<MetadataViews.FLOATEventMetadataView>()) {
          return metadata as! MetadataViews.FLOATEventMetadataView
        }
        return nil
      }
      
      `,
      args: (arg, t) => [
        arg(addr, t.Address),
        arg(parseInt(id), t.UInt64)
      ]
    })
    console.log(queryResult)
    return queryResult || {};
  } catch(e) {
    console.log(e);
  }
}

export const getFLOATEvents = async (addr) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT
      import MetadataViews from 0xMDV

      pub fun main(account: Address): {String: MetadataViews.FLOATEventMetadataView} {
        let floatEventCollection = getAccount(account).getCapability(FLOAT.FLOATEventsPublicPath)
                                    .borrow<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic, MetadataViews.ResolverCollection}>()
                                    ?? panic("Could not borrow the FLOAT Events Collection from the account.")
        let floatEvents: [UInt64] = floatEventCollection.getIDs()
        let returnVal: {String: MetadataViews.FLOATEventMetadataView} = {}
      
        for id in floatEvents {
          let view = floatEventCollection.borrowViewResolver(id: id)
          if var metadata = view.resolveView(Type<MetadataViews.FLOATEventMetadataView>()) {
            var floatEvent = metadata as! MetadataViews.FLOATEventMetadataView
            returnVal[floatEvent.name] = floatEvent
          }
        }
        return returnVal
      }
      `,
      args: (arg, t) => [
        arg(addr, t.Address)
      ]
    })
    console.log(queryResult)
    return queryResult || {};
  } catch(e) {
    console.log(e);
  }
}

export const getFLOATs = async (addr) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT
      import MetadataViews from 0xMDV
      import NonFungibleToken from 0xNFT

      pub fun main(account: Address): [MetadataViews.FLOATMetadataView] {
        let nftCollection = getAccount(account).getCapability(FLOAT.FLOATCollectionPublicPath)
                              .borrow<&FLOAT.Collection{NonFungibleToken.CollectionPublic, MetadataViews.ResolverCollection}>()
                              ?? panic("Could not borrow the Collection from the account.")
        let floats = nftCollection.getIDs()
        var returnVal: [MetadataViews.FLOATMetadataView] = []
        for id in floats {
          let view = nftCollection.borrowViewResolver(id: id)
          if var metadata = view.resolveView(Type<MetadataViews.FLOATMetadataView>()) {
            var float = metadata as! MetadataViews.FLOATMetadataView
            returnVal.append(float)
          }
        }
      
        return returnVal
      }
      
      `,
      args: (arg, t) => [
        arg(addr, t.Address)
      ]
    })
    console.log(queryResult)
    return queryResult || [];
  } catch(e) {
    console.log(e);
  }
}

function initTransactionState() {
  transactionInProgress.set(true);
  transactionStatus.set(-1);
}